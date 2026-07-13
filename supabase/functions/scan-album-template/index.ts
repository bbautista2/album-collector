// Supabase Edge Function: scan-album-template
// Scans a (possibly partially completed) album grid image to detect sticker
// numbers/prefixes that are still MISSING (not marked/crossed/checked off).
// Used during album CREATION (before the album exists in DB).
// No album ownership verification needed — only requires valid JWT.
// @ts-ignore: Deno runtime types
/// <reference lib="deno.ns" />

import { serve } from 'https://deno.land/std@0.201.0/http/server.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Access-Control-Max-Age': '86400',
}

function extractUserFromJWT(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  try {
    const parts = authHeader.substring(7).split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload.sub || null
  } catch {
    return null
  }
}

async function fileToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)))
  }
  return btoa(binary)
}

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const obj = text.match(/\{[\s\S]*\}/)
  return obj?.[0]?.trim() || text.trim()
}

// Both prompts are instructed to always respond with this SAME shape:
// { "missing_by_prefix": [ { "prefix": "", "numbers": [1,2,3] }, ... ] }
function hasDetectedNumbers(payload: any): boolean {
  return (
    Array.isArray(payload?.missing_by_prefix) &&
    payload.missing_by_prefix.some(
      (g: any) => Array.isArray(g?.numbers) && g.numbers.length > 0
    )
  )
}

async function callGemini(prompt: string, base64: string, mime: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mime, data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || ''
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    // Require a valid user session (but no album ownership check)
    const userId = extractUserFromJWT(req.headers.get('authorization'))
    if (!userId) return jsonResponse({ error: 'Missing or invalid authorization' }, 401)

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('form-data')) {
      return jsonResponse({ error: 'Se requiere multipart/form-data' }, 400)
    }

    const form = await req.formData()
    const file = form.get('image') as File | null
    const albumTitle = String(form.get('albumTitle') || '')

    if (!file) return jsonResponse({ error: 'No se envió imagen' }, 400)

    const mime = file.type || 'image/jpeg'
    const base64 = await fileToBase64(await file.arrayBuffer())

    // Primary prompt: detect only MISSING stickers (NOT marked/crossed/checked off),
    // grouped by prefix, in a single consistent JSON shape.
    const promptPrimary = [
      `Hoja de control del álbum: "${albumTitle || 'sin nombre'}".`,
      'Esta es una planilla donde el usuario marca (tachando, poniendo una X, un círculo, coloreando o subrayando) los números de las figuritas que YA TIENE.',
      'TU TAREA: Detecta ÚNICAMENTE los números que NO están marcados/tachados/coloreados — es decir, las figuritas que FALTAN.',
      'IGNORA por completo cualquier número que tenga una marca encima (tachado, X, círculo, relleno, subrayado, resaltado).',
      'Si un número está limpio y sin ninguna marca, inclúyelo como faltante.',
      'Agrupa los resultados por el prefijo de texto que acompañe al número (por ejemplo si ves "T-1", "T-2" el prefijo es "T-"; si son solo números sueltos como "1", "2", usa prefijo vacío "").',
      'Si hay varias secciones con distintos prefijos, agrégalas todas en el mismo array, cada una con su propio grupo.',
      'Responde ÚNICAMENTE con este JSON exacto, sin texto adicional ni bloques de markdown:',
      '{"missing_by_prefix":[{"prefix":"","numbers":[2,4,9]},{"prefix":"T-","numbers":[1,3,5]}]}',
    ].join(' ')

    let rawText = ''
    let parsed: any = null

    try {
      rawText = await callGemini(promptPrimary, base64, mime)
      parsed = JSON.parse(extractJsonBlock(rawText))
      console.log('Primary scan result:', JSON.stringify(parsed).substring(0, 300))
    } catch (err) {
      console.error('Primary scan parse error:', err)
      parsed = null
    }

    // If primary found nothing, retry with a more aggressive/explicit OCR prompt
    if (!hasDetectedNumbers(parsed)) {
      console.log('Primary returned empty, trying fallback OCR...')

      const promptFallback = [
        `Hoja de control del álbum: "${albumTitle || 'sin nombre'}".`,
        'SEGUNDA BÚSQUEDA MÁS DETALLADA: Recorre la imagen de arriba a abajo, sección por sección.',
        'Cada número representa una figurita. Si el número tiene ENCIMA cualquier tipo de marca manual (tachón, X, círculo, relleno de color, subrayado), significa que el usuario YA TIENE esa figurita — NO la incluyas.',
        'Si el número está limpio, sin ninguna marca, esa figurita FALTA — inclúyela.',
        'Lee también los prefijos de texto/letras que acompañen a los números en cada sub-sección (ej. "T-", "E-", o vacío si son solo números).',
        'No omitas ninguna sección, incluidas las secciones pequeñas al final de la hoja.',
        'Devuelve JSON estricto, sin texto adicional:',
        '{"missing_by_prefix":[{"prefix":"","numbers":[...]},{"prefix":"T-","numbers":[...]}]}',
        'Si TODAS las figuritas de una sección están marcadas (no falta ninguna), incluye esa sección con "numbers":[].',
      ].join(' ')

      try {
        const fallbackText = await callGemini(promptFallback, base64, mime)
        const fallbackParsed = JSON.parse(extractJsonBlock(fallbackText))
        console.log('Fallback scan result:', JSON.stringify(fallbackParsed).substring(0, 300))

        if (hasDetectedNumbers(fallbackParsed)) {
          parsed = fallbackParsed
          rawText = fallbackText
        }
      } catch (err) {
        console.error('Fallback scan error:', err)
      }
    }

    // Normalize output: dedupe numbers, filter positives, sort
    const missing_by_prefix: Array<{ prefix: string; numbers: number[] }> = []
    if (Array.isArray(parsed?.missing_by_prefix)) {
      for (const group of parsed.missing_by_prefix) {
        const prefix = String(group?.prefix || '')
        const numbers = Array.from(
          new Set<number>(
            (Array.isArray(group?.numbers) ? group.numbers : [])
              .map((v: any) => Number(v))
              .filter((v: number) => Number.isInteger(v) && v > 0)
          )
        ).sort((a, b) => a - b)
        if (numbers.length > 0) {
          missing_by_prefix.push({ prefix, numbers })
        }
      }
    }

    return jsonResponse({ missing_by_prefix, rawText, model: GEMINI_MODEL })
  } catch (err: any) {
    console.error('Unhandled error:', err)
    return jsonResponse({ error: err?.message || String(err) }, 500)
  }
})
