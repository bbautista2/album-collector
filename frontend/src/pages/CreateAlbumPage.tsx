import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useCollectorStore } from '../stores/collectorStore'
import type { StickerDraft } from '../types'
 

type InputMode = 'range' | 'list' | 'groups'

function parseStickerList(rawValue: string): StickerDraft[] {
  return rawValue
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): StickerDraft | null => {
      const parts = line.split(/[|,;\t]/).map((part) => part.trim())
      const stickerNumber = Number.parseInt(parts[0] || '', 10)

      if (!Number.isInteger(stickerNumber)) {
        return null
      }

      return {
        sticker_number: stickerNumber,
        name: parts[1] || `Sticker ${stickerNumber}`,
        category_or_team: parts[2] ? parts[2] : null,
      }
    })
    .filter((item): item is StickerDraft => item !== null)
}

function parseGroupRanges(rawValue: string): StickerDraft[] {
  // Accept lines or comma-separated tokens like:
  // t1-20
  // e1-40
  // 41-60
  // or combined: t1-20,e1-40,41-60
  const tokens = rawValue
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean)

  const drafts: StickerDraft[] = []
  let seq = 1

  for (const token of tokens) {
    // match patterns like t1-20, t1-t20, 1-50, 5
    const mRange = token.match(/^([A-Za-z]*)?(\d+)\s*-\s*([A-Za-z]*)?(\d+)$/)
    const mSingle = token.match(/^([A-Za-z]*)(\d+)$/)

    if (mRange) {
      const prefixStart = mRange[1] || ''
      const startNum = parseInt(mRange[2], 10)
      const prefixEnd = mRange[3] || ''
      const endNum = parseInt(mRange[4], 10)

      // prefer explicit prefix if provided in either side
      const prefix = prefixStart || prefixEnd || ''
      const first = Math.min(startNum, endNum)
      const last = Math.max(startNum, endNum)

      for (let n = first; n <= last; n++) {
        const label = prefix ? `${prefix}${n}` : `${n}`
        drafts.push({ sticker_number: seq, name: label, category_or_team: null })
        seq += 1
      }
      continue
    }

    if (mSingle) {
      const prefix = mSingle[1] || ''
      const num = parseInt(mSingle[2], 10)
      const label = prefix ? `${prefix}${num}` : `${num}`
      drafts.push({ sticker_number: seq, name: label, category_or_team: null })
      seq += 1
      continue
    }

    // fallback: try parse number only
    const n = Number.parseInt(token.replace(/[^0-9]/g, ''), 10)
    if (Number.isInteger(n)) {
      drafts.push({ sticker_number: seq, name: `${n}`, category_or_team: null })
      seq += 1
    }
  }

  return drafts
}

function buildRangeStickers(start: number, end: number, prefix: string, category: string): StickerDraft[] {
  const first = Math.min(start, end)
  const last = Math.max(start, end)
  const safePrefix = prefix.trim() || 'Sticker'
  const safeCategory = category.trim()

  return Array.from({ length: last - first + 1 }, (_, index) => {
    const stickerNumber = first + index
    return {
      sticker_number: stickerNumber,
      name: `${safePrefix} ${stickerNumber}`,
      category_or_team: safeCategory || null,
    }
  })
}

export function CreateAlbumPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { createAlbum, activateAlbum, isLoading, error } = useCollectorStore()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [inputMode, setInputMode] = useState<InputMode>('range')
  const [rangeStart, setRangeStart] = useState(1)
  const [rangeEnd, setRangeEnd] = useState(50)
  const [rangePrefix, setRangePrefix] = useState('Sticker')
  const [rangeCategory, setRangeCategory] = useState('')
  const [stickerListText, setStickerListText] = useState('1|Sticker 1|Equipo A\n2|Sticker 2|Equipo A')
  const [groupListText, setGroupListText] = useState('t1-20\ne1-40\n61-100')
  const [formError, setFormError] = useState<string | null>(null)
  

  const stickerDrafts = useMemo(() => {
    let source: StickerDraft[] = []
    if (inputMode === 'range') {
      source = buildRangeStickers(rangeStart, rangeEnd, rangePrefix, rangeCategory)
    } else if (inputMode === 'list') {
      source = parseStickerList(stickerListText)
    } else {
      source = parseGroupRanges(groupListText)
    }

    const deduplicated = new Map<number, StickerDraft>()
    source.forEach((sticker) => {
      deduplicated.set(sticker.sticker_number, sticker)
    })

    return Array.from(deduplicated.values()).sort((first, second) => first.sticker_number - second.sticker_number)
  }, [inputMode, rangeCategory, rangeEnd, rangePrefix, rangeStart, stickerListText, groupListText])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) {
      navigate('/login')
      return
    }

    if (!title.trim()) {
      setFormError('El álbum debe tener un título')
      return
    }

    if (stickerDrafts.length === 0) {
      setFormError('Debes definir al menos una figurita')
      return
    }

    setFormError(null)

    const albumId = await createAlbum(user.id, {
      title: title.trim(),
      description: description.trim(),
      image_url: imageUrl.trim(),
      stickers: stickerDrafts,
    })

    if (!albumId) {
      return
    }

    await activateAlbum(user.id, albumId)

    navigate(`/album/${albumId}`)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Crear nuevo álbum</h1>
          <p className="mt-2 text-gray-600">
            Publica un álbum propio y define tus figuritas por rango o mediante una lista detallada.
          </p>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Volver
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 rounded-xl bg-white p-6 shadow-md">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Título del álbum</label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Liga Local 2026"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Descripción</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Describe el álbum, su temática y alcance"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Imagen de portada (URL opcional)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setInputMode('range')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  inputMode === 'range'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Generar por rango
              </button>
              <button
                type="button"
                onClick={() => setInputMode('list')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  inputMode === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cargar lista manual
              </button>
            </div>

            {inputMode === 'range' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Número inicial</label>
                  <input
                    type="number"
                    min="1"
                    value={rangeStart}
                    onChange={(event) => setRangeStart(Number.parseInt(event.target.value || '1', 10))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Número final</label>
                  <input
                    type="number"
                    min="1"
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(Number.parseInt(event.target.value || '1', 10))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Prefijo del nombre</label>
                  <input
                    type="text"
                    value={rangePrefix}
                    onChange={(event) => setRangePrefix(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Categoría / Equipo</label>
                  <input
                    type="text"
                    value={rangeCategory}
                    onChange={(event) => setRangeCategory(event.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
              </div>
            ) : inputMode === 'list' ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Lista de figuritas</label>
                <textarea
                  value={stickerListText}
                  onChange={(event) => setStickerListText(event.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Usa una línea por figurita: <code>numero|nombre|categoria</code>. El nombre y la categoría son opcionales.
                </p>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Grupos / Prefijos</label>
                <textarea
                  value={groupListText}
                  onChange={(event) => setGroupListText(event.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Define grupos por línea o separados por comas. Ejemplos: <code>t1-20</code>, <code>e1-40</code>, <code>61-100</code>.
                  Los prefijos se mantendrán en el nombre (p.ej. <code>t1</code>), y las posiciones serán asignadas secuencialmente.
                </p>
              </div>
            )}
          </div>

          {(formError || error) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary-600 px-4 py-3 font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Creando álbum...' : 'Crear álbum y abrir colección'}
          </button>
        </div>

        <aside className="space-y-4 rounded-xl bg-slate-900 p-6 text-white shadow-md">
          <div>
            <p className="text-sm uppercase tracking-wide text-primary-200">Vista previa</p>
            <h2 className="mt-2 text-2xl font-semibold">{title.trim() || 'Tu nuevo álbum'}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {description.trim() || 'La descripción aparecerá aquí cuando completes el formulario.'}
            </p>
          </div>

          <div className="rounded-lg bg-slate-800 p-4">
            <p className="text-sm text-slate-300">Total de figuritas</p>
            <p className="mt-2 text-4xl font-bold text-white">{stickerDrafts.length}</p>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-slate-300">Primeras figuritas</p>
            <div className="space-y-2">
              {stickerDrafts.slice(0, 8).map((sticker) => (
                <div key={sticker.sticker_number} className="rounded-lg bg-slate-800 px-3 py-2 text-sm">
                  <span className="font-semibold text-primary-200">#{sticker.sticker_number}</span>{' '}
                  {sticker.name}
                  {sticker.category_or_team ? (
                    <span className="ml-2 text-xs text-slate-400">· {sticker.category_or_team}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </form>
    </div>
  )
}
