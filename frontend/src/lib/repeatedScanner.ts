import type { DetectedStickerNumber, ScanRepeatedResponse } from '../types'

interface ScanRepeatedInput {
  file: File
  albumTitle: string
  validStickerNumbers: number[]
}

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY
const geminiModel = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash'

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
}: ScanRepeatedInput): Promise<ScanRepeatedResponse> {
  if (!geminiApiKey) {
    throw new Error('Falta `VITE_GEMINI_API_KEY` en tus variables de entorno')
  }

  if (validStickerNumbers.length === 0) {
    return { detectedNumbers: [] }
  }

  const base64Image = await fileToBase64(file)
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
