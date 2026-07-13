import type { DetectedStickerNumber, ScanRepeatedResponse } from '../types'
import { supabase } from './supabase'

interface ScanRepeatedInput {
  file: File
  albumTitle: string
  validStickerNumbers: number[]
  albumId?: number | string
}

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY
const geminiModel = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash'
const useProcessFunction = import.meta.env.VITE_USE_PROCESS_FUNCTION === 'true'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('No se pudo leer la imagen'))
        return
      }
      resolve(result.split(',')[1] || '')
    }
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

function normalizeDetectedNumbers(numbers: number[], validStickerNumbers: number[]): DetectedStickerNumber[] {
  const validSet = new Set(validStickerNumbers)
  const counts = new Map<number, number>()

  numbers.forEach((value) => {
    if (!Number.isInteger(value) || !validSet.has(value)) {
      return
    }
    counts.set(value, (counts.get(value) || 0) + 1)
  })

  return Array.from(counts.entries())
    .sort((first, second) => first[0] - second[0])
    .map(([stickerNumber, count]) => ({ stickerNumber, count }))
}

function extractJsonBlock(text: string): string {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  const objectMatch = text.match(/\{[\s\S]*\}/)
  return objectMatch?.[0]?.trim() || text.trim()
}

function extractNumbersFallback(text: string, validStickerNumbers: number[]): DetectedStickerNumber[] {
  const matches = text.match(/\d+/g) || []
  const numbers = matches.map((value) => Number.parseInt(value, 10))
  return normalizeDetectedNumbers(numbers, validStickerNumbers)
}

export async function scanRepeatedStickers({
  file,
  albumTitle,
  validStickerNumbers,
  albumId,
}: ScanRepeatedInput): Promise<ScanRepeatedResponse> {
  if (!geminiApiKey) {
    throw new Error('Falta `VITE_GEMINI_API_KEY` en tus variables de entorno')
  }

  const base64Image = await fileToBase64(file)

  // Determine if we should use Edge Function or client-side Gemini
  // Use Edge Function only if albumId is provided (inventory mode with album verification)
  // In creation mode (no albumId), call Gemini directly from client
  const useEdgeFunction = useProcessFunction && albumId

  console.log('📡 Scan configuration:', {
    useProcessFunction,
    albumId,
    useEdgeFunction,
    albumTitle,
    validStickerNumbers: validStickerNumbers.length,
    geminiModel,
  })

  if (useEdgeFunction) {
    // INVENTORY MODE: Use Edge Function with album verification
    console.log('🔗 Using Edge Function (inventory mode)...')

    const form = new FormData()
    form.append('image', file)
    form.append('albumTitle', albumTitle)
    form.append('validStickerNumbers', JSON.stringify(validStickerNumbers))
    form.append('albumId', String(albumId))

    // supabase.functions.invoke automatically adds the Authorization header with the user's JWT
    const res = await supabase.functions.invoke('process-grid-image', { body: form })
    if (!res || !res.data) {
      throw new Error('La función de procesamiento no devolvió datos')
    }

    // Esperamos que la función retorne { missing_by_prefix: [{ prefix, numbers: [...] }], rawText?, model? }
    const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data

    // If function returned grouped missing_by_prefix, return it directly so frontend can map by section/prefix
    const missingByPrefix = Array.isArray(json.missing_by_prefix)
      ? json.missing_by_prefix.map((g: any) => ({ prefix: String(g.prefix || ''), numbers: (g.numbers || []).map(Number) }))
      : undefined

    // Also return normalized detectedNumbers for backwards compatibility
    const expanded: number[] = []
    if (missingByPrefix) {
      missingByPrefix.forEach((group: { prefix: string; numbers: number[] }) =>
        group.numbers.forEach((n: number) => expanded.push(Number(n)))
      )
    }

    return {
      detectedNumbers: normalizeDetectedNumbers(expanded, validStickerNumbers),
      rawText: json.rawText || '',
      model: json.model || 'process-grid-image',
      missingByPrefix,
    }
  } else {
    // CREATION MODE: Call Gemini directly from client (no album verification needed)
    console.log('🤖 Using direct Gemini API (creation mode)...')

    const prompt = [
      `Imagen de álbum: "${albumTitle || 'sin nombre'}"`,
      'Tu tarea: Extrae TODOS los números o códigos alfanuméricos visibles en esta imagen.',
      'Ejemplos: números como 1, 2, 15, 42, 100',
      'Ejemplos con prefijo: T1, T2, T20, E1, E5, E40',
      'Agrupa los números por su prefijo (si no hay prefijo, usa cadena vacía).',
      'Responde ÚNICAMENTE con JSON en este formato exacto (sin explicación extra):',
      '{"missing_by_prefix":[{"prefix":"","numbers":[1,2,3,4,5]},{"prefix":"T","numbers":[1,2,3]}]}',
    ].join(' ')

    console.log('🎯 Prompt:', prompt.substring(0, 100) + '...')

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: file.type || 'image/jpeg',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    console.log('📨 Gemini API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Gemini API error:', errorText)
      throw new Error(`Gemini API error: ${errorText}`)
    }

    const data = await response.json()
    const rawText = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || ''

    console.log('📝 Raw response from Gemini:', rawText)

    try {
      const parsed = JSON.parse(extractJsonBlock(rawText)) as {
        missing_by_prefix?: Array<{ prefix?: string; numbers?: number[] }>
      }

      console.log('✅ Parsed JSON:', parsed)

      const missingByPrefix = Array.isArray(parsed.missing_by_prefix)
        ? parsed.missing_by_prefix.map((g) => ({
            prefix: String(g.prefix || ''),
            numbers: Array.isArray(g.numbers) ? g.numbers.map(Number) : [],
          }))
        : undefined

      console.log('📊 Final missing_by_prefix:', missingByPrefix)

      return {
        detectedNumbers: [],
        rawText,
        model: geminiModel,
        missingByPrefix,
      }
    } catch (err) {
      console.error('❌ Error parsing Gemini response:', err, 'Raw text was:', rawText)
      throw new Error(`Failed to parse image detection response: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const prompt = [
    'Analiza la foto y detecta únicamente números de figuritas visibles.',
    `El álbum es: ${albumTitle}.`,
    `Los únicos números válidos para este álbum son: ${validStickerNumbers.join(', ')}.`,
    'Ignora texto que no sea número de figurita, brillos, manos, fondos y números incompletos.',
    'Si el mismo número aparece varias veces, cuenta cuántas veces aparece.',
    'Devuelve SOLO JSON con este formato exacto:',
    '{"detectedNumbers":[{"stickerNumber":123,"count":2}],"rawText":"opcional"}',
  ].join(' ')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: file.type || 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini OCR falló: ${errorText}`)
  }

  const data = await response.json()
  const rawText = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || ''

  try {
    const parsed = JSON.parse(extractJsonBlock(rawText)) as {
      detectedNumbers?: Array<{ stickerNumber?: number; count?: number }>
      rawText?: string
    }

    const expandedNumbers = (parsed.detectedNumbers || []).flatMap((item) => {
      const stickerNumber = Number(item.stickerNumber)
      const count = Math.max(1, Number(item.count) || 1)
      if (!Number.isInteger(stickerNumber)) {
        return []
      }
      return Array.from({ length: count }, () => stickerNumber)
    })

    return {
      detectedNumbers: normalizeDetectedNumbers(expandedNumbers, validStickerNumbers),
      rawText: parsed.rawText || rawText,
      model: geminiModel,
    }
  } catch {
    return {
      detectedNumbers: extractNumbersFallback(rawText, validStickerNumbers),
      rawText,
      model: geminiModel,
    }
  }
}
