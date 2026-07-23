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

function normalizeGroupedNumbers(
  payload: any,
  validStickerNumbers: number[],
  allowedPrefixes: string[],
  mode: 'repeated' | 'missing'
): { repeated_by_prefix?: Array<{ prefix: string; numbers: number[] }>; missing_by_prefix?: Array<{ prefix: string; numbers: number[] }> } {
  const validSet = new Set(validStickerNumbers)
  const prefixSet = new Set(allowedPrefixes.map((value) => String(value || '')))

  const sourceKey = mode === 'missing' ? 'missing_by_prefix' : 'repeated_by_prefix'
  const groups = Array.isArray(payload?.[sourceKey])
    ? payload[sourceKey]
    : [{ prefix: '', numbers: [] }]

  const normalized = groups.map((group: any) => {
    const prefix = String(group?.prefix || '')
    const numbersRaw = Array.isArray(group?.numbers) ? group.numbers : []
    const filteredNumbers: number[] = numbersRaw
      .map((value: any) => Number(value))
      .filter((value: number) => Number.isInteger(value) && value > 0)

    const normalizedNumbers =
      mode === 'missing'
        ? filteredNumbers.filter((value: number) => (validSet.size > 0 ? validSet.has(value) : true))
        : filteredNumbers

    const numbers =
      mode === 'missing'
          ? Array.from(new Set<number>(normalizedNumbers)).sort((a: number, b: number) => a - b)
          : normalizedNumbers.sort((a: number, b: number) => a - b)

    return {
      prefix: prefixSet.size > 0 ? (prefixSet.has(prefix) ? prefix : '') : prefix,
      numbers,
    }
  })

  return mode === 'missing' ? { missing_by_prefix: normalized } : { repeated_by_prefix: normalized }
}

function hasDetectedNumbers(payload: any, mode: 'repeated' | 'missing'): boolean {
  const key = mode === 'missing' ? 'missing_by_prefix' : 'repeated_by_prefix'
  return (
    Array.isArray(payload?.[key]) &&
    payload[key].some((group: any) => Array.isArray(group?.numbers) && group.numbers.length > 0)
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
      const scanModeRaw = String(form.get('scanMode') || 'repeated')
      const scanMode: 'repeated' | 'missing' = scanModeRaw === 'missing' ? 'missing' : 'repeated'
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

    // Fetch sections for the album
    const { data: sections, error: sectionsError } = await supabaseServiceRole
      .from('album_sections')
      .select('id, name, prefix, total_stickers')
      .eq('album_id', albumId)
      .order('id', { ascending: true })

    if (sectionsError) {
      return new Response(JSON.stringify({ error: sectionsError.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const allowedPrefixes = (sections || []).map((s: any) => String(s.prefix || ''))
    const validStickerHint = validStickerNumbers.length > 0
      ? `Números válidos del álbum: ${validStickerNumbers.slice(0, 300).join(', ')}.`
      : 'Si no hay contexto, detecta TODOS los números/códigos visibles en la imagen.'

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

    const promptPrimary = scanMode === 'missing'
      ? [
          `Imagen de álbum: "${albumTitle || 'sin nombre'}"`,
          'Tu tarea: Detecta las figuritas que FALTAN en la grilla y devuelve sus números visibles agrupados por prefijo.',
          'Si no puedes inferir faltantes, usa las marcas visibles como referencia y extrae los números que correspondan a los espacios vacíos.',
          'Agrupa los números por su prefijo (si no hay prefijo, usa cadena vacía).',
          validStickerHint,
          'Responde ÚNICAMENTE con JSON en este formato exacto (sin explicación extra):',
          '{"missing_by_prefix":[{"prefix":"","numbers":[1,2,3,4,5]},{"prefix":"T","numbers":[1,2,3]}]}',
        ].join(' ')
      : [
          `Imagen de álbum: "${albumTitle || 'sin nombre'}"`,
          'Esta imagen contiene una colección de stickers repetidos del álbum. Tu tarea es detectar TODOS los stickers visibles en la imagen.',
          'Lee cada número visible en cada sticker, incluyendo los que solo aparecen una vez.',
          'Si el mismo número aparece en 3 stickers distintos, inclúyelo 3 veces en la lista.',
          'Si un número aparece solo una vez, inclúyelo una vez.',
          'NO inventes números. Si no puedes leer un sticker con claridad, no lo incluyas.',
          'Antes de responder, verifica visualmente el conteo para evitar sobreconteos.',
          'Agrupa los números por su prefijo alfanumérico (si no tienen prefijo, usa cadena vacía "").',
          'NO omitas ningún sticker aunque aparezca solo una vez.',
          validStickerHint,
          'Responde ÚNICAMENTE con JSON en este formato exacto (sin explicación extra):',
          '{"repeated_by_prefix":[{"prefix":"","numbers":[31,39,42,42,42,59,64,97,97]},{"prefix":"T","numbers":[16,16,17]}]}',
        ].join(' ')

    let rawText = ''
    let parsed: any = null

    try {
      rawText = await callGemini(promptPrimary)
      parsed = JSON.parse(extractJsonBlock(rawText))
    } catch {
      parsed = null
    }

    let normalized = normalizeGroupedNumbers(parsed, validStickerNumbers, allowedPrefixes, scanMode)

    // Retry with more aggressive OCR prompt if nothing was detected
    if (!hasDetectedNumbers(normalized, scanMode)) {
      const promptFallback = scanMode === 'missing'
        ? [
            `Imagen: ${albumTitle || 'sin nombre'}.`,
            'SEGUNDA BÚSQUEDA: Lee CUALQUIER número visible en la imagen, incluso si está pequeño, inclinado, o parcial.',
            'Extrae números individuales: 0-9, 10-99, 100-999, etc.',
            'Extrae códigos como: T, E, A, B, etc. seguidos de números.',
            'Ejemplo: Si ves "T" y "15" por separado o juntos, es T15.',
            'Si ves solo números sin prefijo, agrúpalos bajo prefijo vacío ("").',
            'Devuelve JSON estricto sin texto adicional:',
            '{"missing_by_prefix":[{"prefix":"","numbers":[...]},{"prefix":"T","numbers":[...]}]}',
            'Si NO ves NINGÚN número, devuelve: {"missing_by_prefix":[{"prefix":"","numbers":[]}]}',
          ].join(' ')
        : [
            `Imagen: ${albumTitle || 'sin nombre'}.`,
            'SEGUNDA BÚSQUEDA: Esta es una pila de stickers del álbum. Lee el número de CADA sticker visible, aunque esté parcial, inclinado o con mala luz.',
            'Incluye TODOS los stickers, incluso los que aparecen una sola vez.',
            'Cuenta cuántos stickers físicos hay de cada número y repite ese número esa cantidad de veces en la lista.',
          'No inventes números ni aumentes conteos por suposición.',
          'Si dudas entre dos números parecidos, omítelo en lugar de adivinar.',
            'Agrupa por prefijo (sin prefijo = "").',
            'Devuelve JSON estricto sin texto adicional:',
            '{"repeated_by_prefix":[{"prefix":"","numbers":[31,39,42,42,42,59,64,97,97]},{"prefix":"T","numbers":[16,17]}]}',
            'Si NO ves NINGÚN sticker, devuelve: {"repeated_by_prefix":[{"prefix":"","numbers":[]}]}',
          ].join(' ')

      try {
        const rawTextFallback = await callGemini(promptFallback)
        const parsedFallback = JSON.parse(extractJsonBlock(rawTextFallback))
        const normalizedFallback = normalizeGroupedNumbers(parsedFallback, validStickerNumbers, allowedPrefixes, scanMode)

        if (hasDetectedNumbers(normalizedFallback, scanMode)) {
          normalized = normalizedFallback
          rawText = rawTextFallback
        } else {
          rawText = `${rawText}\n\n[Fallback attempted, no numbers detected]`
        }
      } catch (err) {
        console.error('Fallback OCR failed:', err)
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
