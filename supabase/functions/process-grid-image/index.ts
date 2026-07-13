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

// Create service role client for admin operations (verify album ownership)
const supabaseServiceRole = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  global: { headers: { 'x-client-info': 'process-grid-image' } },
})

// Extract user from JWT token
function extractUserFromJWT(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.substring(7)
  try {
    // Decode JWT payload (middle part)
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload.sub || null // 'sub' is the user ID in Supabase JWTs
  } catch {
    return null
  }
}

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

function extractJsonBlock(text: string): string {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  const objectMatch = text.match(/\{[\s\S]*\}/)
  return objectMatch?.[0]?.trim() || text.trim()
}

function normalizeMissingByPrefix(
  payload: any,
  validStickerNumbers: number[],
  allowedPrefixes: string[]
): { missing_by_prefix: Array<{ prefix: string; numbers: number[] }> } {
  const validSet = new Set(validStickerNumbers)
  const prefixSet = new Set(allowedPrefixes.map((value) => String(value || '')))

  const groups = Array.isArray(payload?.missing_by_prefix)
    ? payload.missing_by_prefix
    : [{ prefix: '', numbers: [] }]

  const normalized = groups.map((group: any) => {
    const prefix = String(group?.prefix || '')
    const numbersRaw = Array.isArray(group?.numbers) ? group.numbers : []
    const numbers = Array.from(
      new Set<number>(
        numbersRaw
          .map((value: any) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0)
          .filter((value: number) => (validSet.size > 0 ? validSet.has(value) : true))
      )
    ).sort((a, b) => a - b)

    return {
      prefix: prefixSet.size > 0 ? (prefixSet.has(prefix) ? prefix : '') : prefix,
      numbers,
    }
  })

  return { missing_by_prefix: normalized }
}

function hasDetectedNumbers(payload: any): boolean {
  return (
    Array.isArray(payload?.missing_by_prefix) &&
    payload.missing_by_prefix.some((group: any) => Array.isArray(group?.numbers) && group.numbers.length > 0)
  )
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  try {
    // Extract user from Authorization header
    const authHeader = req.headers.get('authorization')
    const userId = extractUserFromJWT(authHeader)

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('form-data')) {
      return new Response(JSON.stringify({ error: 'Se requiere multipart/form-data' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const form = await req.formData()
    const albumIdValue = form.get('albumId')
    const albumId = albumIdValue !== null ? String(albumIdValue) : null
    const albumTitle = String(form.get('albumTitle') || '')
    const validStickerNumbersRaw = String(form.get('validStickerNumbers') || '[]')
    const file = form.get('image') as File | null

    let validStickerNumbers: number[] = []
    try {
      const parsedValid = JSON.parse(validStickerNumbersRaw)
      if (Array.isArray(parsedValid)) {
        validStickerNumbers = parsedValid.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
      }
    } catch {
      validStickerNumbers = []
    }

    if (!file) {
      return new Response(JSON.stringify({ error: 'No se envió imagen' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    if (!albumId) {
      return new Response(JSON.stringify({ error: 'Falta albumId' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    // Debug: log the values we're querying with
    console.log('Query debug:', { userId, albumId })

    // Verify the user owns this album (using service role)
    const { data: album, error: albumError } = await supabaseServiceRole
      .from('albums')
      .select('id, created_by')
      .eq('id', albumId)
      .single()

    console.log('Album query result:', { album, albumError })

    if (albumError || !album) {
      console.error('Album error details:', albumError)
      return new Response(JSON.stringify({ error: 'Álbum no encontrado', debug: { errorMsg: albumError?.message, albumId } }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    if (album.created_by !== userId) {
      return new Response(JSON.stringify({ error: 'No tienes permiso para procesar este álbum' }), { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    // Fetch sections for the album
    const { data: sections, error: sectionsError } = await supabaseServiceRole
      .from('album_sections')
      .select('id, name, prefix, total_stickers')
      .eq('album_id', albumId)
      .order('id', { ascending: true })

    if (sectionsError) {
      return new Response(JSON.stringify({ error: sectionsError.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const sectionSummary = (sections || [])
      .map((s: any) => `Sección '${s.name}' con prefijo '${s.prefix || ''}'`)
      .join(', ')
    const allowedPrefixes = (sections || []).map((s: any) => String(s.prefix || ''))
    const validStickerHint = validStickerNumbers.length > 0
      ? `Números válidos del álbum: ${validStickerNumbers.slice(0, 300).join(', ')}.`
      : 'Si no hay contexto suficiente, devuelve el mejor intento de números visibles.'

    // Read file as base64
    const ab = await file.arrayBuffer()
    const base64 = await fileToBase64FromBuffer(ab, file.type || 'image/jpeg')

    const callGemini = async (promptText: string) => {
      const body = {
        contents: [
          {
            parts: [
              { text: promptText },
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

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text)
      }

      const data = await response.json()
      return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || ''
    }

    const promptPrimary = [
      `Álbum: ${albumTitle || 'sin nombre'}.`,
      `Secciones/prefijos: ${sectionSummary || 'sin secciones'}.`,
      validStickerHint,
      'Analiza la imagen y detecta figuritas faltantes visibles.',
      'Devuelve SOLO JSON con este formato exacto:',
      '{"missing_by_prefix":[{"prefix":"","numbers":[1,2]},{"prefix":"T","numbers":[4,10]}]}',
      'No agregues texto extra fuera del JSON.',
    ].join(' ')

    let rawText = ''
    let parsed: any = null

    try {
      rawText = await callGemini(promptPrimary)
      parsed = JSON.parse(extractJsonBlock(rawText))
    } catch {
      parsed = null
    }

    let normalized = normalizeMissingByPrefix(parsed, validStickerNumbers, allowedPrefixes)

    // Retry with more permissive OCR prompt if nothing was detected
    if (!hasDetectedNumbers(normalized)) {
      const promptFallback = [
        `Álbum: ${albumTitle || 'sin nombre'}.`,
        `Prefijos permitidos: ${(allowedPrefixes.length ? allowedPrefixes : ['']).join(', ')}.`,
        validStickerHint,
        'Segundo intento OCR: identifica todos los códigos o números visibles (por ejemplo T12, 45, E3).',
        'Convierte esos hallazgos a JSON estricto agrupado por prefijo:',
        '{"missing_by_prefix":[{"prefix":"","numbers":[]},{"prefix":"T","numbers":[]}]}',
        'No devuelvas explicación, solo JSON.',
      ].join(' ')

      try {
        const rawTextFallback = await callGemini(promptFallback)
        const parsedFallback = JSON.parse(extractJsonBlock(rawTextFallback))
        const normalizedFallback = normalizeMissingByPrefix(parsedFallback, validStickerNumbers, allowedPrefixes)

        if (hasDetectedNumbers(normalizedFallback)) {
          normalized = normalizedFallback
          rawText = rawTextFallback
        } else {
          rawText = `${rawText}\n\n[Fallback]\n${rawTextFallback}`
        }
      } catch {
        // keep primary result
      }
    }

    return new Response(JSON.stringify({ ...normalized, rawText, model: GEMINI_MODEL }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
      },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  }
})
