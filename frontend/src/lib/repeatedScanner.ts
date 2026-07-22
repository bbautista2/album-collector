import type { DetectedStickerNumber, ScanRepeatedResponse } from '../types'
import { supabase } from './supabase'

interface ScanRepeatedInput {
  file: File
  albumTitle: string
  validStickerNumbers: number[]
  albumId?: number | string
  scanMode?: 'repeated' | 'missing'
}

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY
// geminiModel available if needed for future client-side calls
// const geminiModel = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeDetectedNumbers(numbers: number[], validStickerNumbers: number[]): DetectedStickerNumber[] {
  const validSet = new Set(validStickerNumbers)
  const counts = new Map<number, number>()
  numbers.forEach((v) => {
    if (!Number.isInteger(v) || !validSet.has(v)) return
    counts.set(v, (counts.get(v) || 0) + 1)
  })
  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([stickerNumber, count]) => ({ stickerNumber, count }))
}

function parseMissingByPrefix(json: unknown) {
  const raw = (json as any)?.missing_by_prefix
  if (!Array.isArray(raw)) return undefined
  return raw.map((g: any) => ({
    prefix: String(g?.prefix || ''),
    numbers: Array.isArray(g?.numbers) ? g.numbers.map(Number) : [],
  }))
}

function parseRepeatedByPrefix(json: unknown) {
  const raw = (json as any)?.repeated_by_prefix
  if (!Array.isArray(raw)) return undefined
  return raw.map((g: any) => ({
    prefix: String(g?.prefix || ''),
    numbers: Array.isArray(g?.numbers) ? g.numbers.map(Number) : [],
  }))
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function scanRepeatedStickers({
  file,
  albumTitle,
  validStickerNumbers,
  albumId,
  scanMode = 'repeated',
}: ScanRepeatedInput): Promise<ScanRepeatedResponse> {
  if (!geminiApiKey) {
    throw new Error('Falta VITE_GEMINI_API_KEY en tus variables de entorno')
  }

  // ── CREATION MODE: no albumId → scan-album-template ──────────────────────
  if (!albumId) {
    console.log('🆕 Creation mode → calling scan-album-template')

    const form = new FormData()
    form.append('image', file)
    form.append('albumTitle', albumTitle)

    const res = await supabase.functions.invoke('scan-album-template', { body: form })

    if (res.error) {
      console.error('❌ scan-album-template error:', res.error)
      throw new Error(res.error.message || 'Error al llamar al escáner de plantilla')
    }
    if (!res.data) throw new Error('La función no devolvió datos')

    const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
    console.log('✅ scan-album-template response:', json)

    return {
      detectedNumbers: [],
      rawText: json.rawText || '',
      model: json.model || 'scan-album-template',
      missingByPrefix: parseMissingByPrefix(json),
    }
  }

  // ── INVENTORY MODE: albumId present → process-grid-image ─────────────────
  console.log('📦 Inventory mode → calling process-grid-image', { albumId })

  const form = new FormData()
  form.append('image', file)
  form.append('albumTitle', albumTitle)
  form.append('validStickerNumbers', JSON.stringify(validStickerNumbers))
  form.append('albumId', String(albumId))
  form.append('scanMode', scanMode)

  const res = await supabase.functions.invoke('process-grid-image', { body: form })

  if (res.error) {
    console.error('❌ process-grid-image error:', res.error)
    throw new Error(res.error.message || 'Error al llamar al procesador de imagen')
  }
  if (!res.data) throw new Error('La función de procesamiento no devolvió datos')

  const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
  console.log('✅ process-grid-image response:', json)

  const missingByPrefix = parseMissingByPrefix(json)
  const repeatedByPrefix = parseRepeatedByPrefix(json)
  const expanded: number[] = []
  ;(repeatedByPrefix || missingByPrefix)?.forEach((g) => g.numbers.forEach((n: number) => expanded.push(n)))

  return {
    detectedNumbers: normalizeDetectedNumbers(expanded, validStickerNumbers),
    rawText: json.rawText || '',
    model: json.model || 'process-grid-image',
    missingByPrefix,
    repeatedByPrefix,
  }
}
