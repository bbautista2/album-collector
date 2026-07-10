// Supabase Edge Function: process-grid-image
// @ts-ignore: Deno runtime types
/// <reference lib="deno.ns" />
// Nota: this is a Deno/Edge function. It expects the following environment variables to be set in Supabase:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GEMINI_MODEL (optional)

// Use explicit ESM imports compatible with Deno bundling
import { serve } from 'https://deno.land/std@0.201.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  global: { headers: { 'x-client-info': 'process-grid-image' } },
})

async function fileToBase64FromBuffer(buffer: ArrayBuffer, mime = 'image/jpeg') {
  // Deno btoa expects a string; convert bytes to binary string
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

serve(async (req: Request) => {
  try {
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('form-data')) {
      return new Response(JSON.stringify({ error: 'Se requiere multipart/form-data' }), { status: 400 })
    }

    const form = await req.formData()
    const albumIdValue = form.get('albumId')
    const albumId = albumIdValue !== null ? String(albumIdValue) : null
    const albumTitle = String(form.get('albumTitle') || '')
    const file = form.get('image') as File | null

    if (!file) {
      return new Response(JSON.stringify({ error: 'No se envió imagen' }), { status: 400 })
    }

    if (!albumId) {
      return new Response(JSON.stringify({ error: 'Falta albumId' }), { status: 400 })
    }

    // Fetch sections for the album
    const { data: sections, error: sectionsError } = await supabase
      .from('album_sections')
      .select('id, name, prefix, total_stickers')
      .eq('album_id', albumId)
      .order('id', { ascending: true })

    if (sectionsError) {
      return new Response(JSON.stringify({ error: sectionsError.message }), { status: 500 })
    }

    const sectionSummary = (sections || [])
      .map((s: any) => `Sección '${s.name}' con prefijo '${s.prefix || ''}'`)
      .join(', ')

    // Read file as base64
    const ab = await file.arrayBuffer()
    const base64 = await fileToBase64FromBuffer(ab, file.type || 'image/jpeg')

    // Build prompt
    const prompt = `Analiza la imagen de la grilla de control. El usuario ha tachado con una 'X' las que ya tiene. Extrae los elementos que NO están tachados (los faltantes). Este álbum está compuesto por las siguientes secciones y prefijos: ${sectionSummary}. Devuelve estrictamente un formato JSON que mapee las faltas encontradas agrupadas por su prefijo, por ejemplo: { "missing_by_prefix": [ { "prefix": "", "numbers": [1, 3, 5] }, { "prefix": "T", "numbers": [4, 6, 12] } ] }`

    const body = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: file.type || 'image/jpeg',
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    if (!resp.ok) {
      const text = await resp.text()
      return new Response(JSON.stringify({ error: text }), { status: resp.status })
    }

    const data = await resp.json()

    const rawText = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || ''

    // Try to extract JSON block
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    let parsed = null
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch (e) {
        // ignore
      }
    }

    // If parse failed, try to extract numbers heuristically (simple fallback)
    if (!parsed) {
      const rawMatches = rawText.match(/\d+/g) || []
      const nums = Array.from(new Set(rawMatches.map((n: string) => Number(n))))
      // Group all as prefix '' fallback
      parsed = { missing_by_prefix: [{ prefix: '', numbers: nums }] }
    }

    return new Response(JSON.stringify({ ...(parsed || {}), rawText, model: GEMINI_MODEL }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500 })
  }
})
