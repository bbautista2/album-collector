import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useCollectorStore } from '../stores/collectorStore'
import type { StickerDraft } from '../types'

type InputMode = 'range' | 'list' | 'groups'
type CreateStep = 'basic-info' | 'load-method'

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

// ========== Component: LoadMethodCard ==========
interface LoadMethodCardProps {
  icon: string
  title: string
  description: string
  selected: boolean
  onClick: () => void
}

function LoadMethodCard({ icon, title, description, selected, onClick }: LoadMethodCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border-2 p-6 text-left transition ${
        selected
          ? 'border-primary-500 bg-primary-50 shadow-lg'
          : 'border-gray-200 bg-white hover:border-primary-300 shadow-sm'
      }`}
    >
      <div className="text-4xl">{icon}</div>
      <h3 className={`mt-4 text-xl font-semibold ${selected ? 'text-primary-700' : 'text-gray-900'}`}>
        {title}
      </h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </button>
  )
}

// ========== Component: RangeForm ==========
interface RangeFormProps {
  rangeStart: number
  rangeEnd: number
  rangePrefix: string
  rangeCategory: string
  onStartChange: (value: number) => void
  onEndChange: (value: number) => void
  onPrefixChange: (value: string) => void
  onCategoryChange: (value: string) => void
}

function RangeForm({
  rangeStart,
  rangeEnd,
  rangePrefix,
  rangeCategory,
  onStartChange,
  onEndChange,
  onPrefixChange,
  onCategoryChange,
}: RangeFormProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Número inicial</label>
        <input
          type="number"
          min="1"
          value={rangeStart}
          onChange={(event) => onStartChange(Number.parseInt(event.target.value || '1', 10))}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Número final</label>
        <input
          type="number"
          min="1"
          value={rangeEnd}
          onChange={(event) => onEndChange(Number.parseInt(event.target.value || '1', 10))}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Prefijo del nombre</label>
        <input
          type="text"
          value={rangePrefix}
          onChange={(event) => onPrefixChange(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Categoría / Equipo</label>
        <input
          type="text"
          value={rangeCategory}
          onChange={(event) => onCategoryChange(event.target.value)}
          placeholder="Opcional"
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
      </div>
    </div>
  )
}

// ========== Main Component ==========
export function CreateAlbumPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { createAlbum, activateAlbum, isLoading, error } = useCollectorStore()

  // Step management
  const [currentStep, setCurrentStep] = useState<CreateStep>('basic-info')

  // Step 1: Basic info
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  // Step 2: Load method
  const [loadMethod, setLoadMethod] = useState<'manual' | 'ai'>('manual')
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

  const handleBasicInfoSubmit = () => {
    if (!title.trim()) {
      setFormError('El álbum debe tener un título')
      return
    }
    setFormError(null)
    setCurrentStep('load-method')
  }

  const handleLoadMethodSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) {
      navigate('/login')
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

  // ========== RENDER ==========

  if (currentStep === 'basic-info') {
    return (
      <div className="mx-auto max-w-2xl space-y-8 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Crear nuevo álbum</h1>
            <p className="mt-2 text-gray-600">Completa la información básica para comenzar.</p>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Volver
          </button>
        </div>

        <div className="space-y-6 rounded-xl bg-white p-8 shadow-md">
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="mb-2 block text-sm font-semibold text-gray-900">
                Título del álbum *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Liga Local 2026, Pokémon Base Set, etc."
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>

            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-semibold text-gray-900">
                Descripción (opcional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Describe el álbum, su temática, alcance y cualquier detalle importante..."
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>

            <div>
              <label htmlFor="imageUrl" className="mb-2 block text-sm font-semibold text-gray-900">
                Imagen de portada (URL opcional)
              </label>
              <input
                id="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleBasicInfoSubmit}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-3 font-semibold text-white transition hover:bg-primary-700"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ========== STEP 2: LOAD METHOD ==========

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cargar figuritas</h1>
          <p className="mt-2 text-gray-600">Elige cómo deseas inicializar el catálogo del álbum.</p>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Volver
        </button>
      </div>

      <form onSubmit={handleLoadMethodSubmit} className="space-y-8">
        {/* Load Method Selection */}
        <div className="grid gap-6 md:grid-cols-2">
          <LoadMethodCard
            icon="✏️"
            title="Configuración Manual"
            description="Crea secciones con rangos de números, listas personalizadas o grupos con prefijos."
            selected={loadMethod === 'manual'}
            onClick={() => setLoadMethod('manual')}
          />
          <LoadMethodCard
            icon="📷"
            title="Inicializar con Foto"
            description="Carga una imagen de la plantilla para que Gemini AI detecte automáticamente la estructura."
            selected={loadMethod === 'ai'}
            onClick={() => setLoadMethod('ai')}
          />
        </div>

        {/* Manual Configuration */}
        {loadMethod === 'manual' && (
          <div className="space-y-6 rounded-xl bg-white p-8 shadow-md">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Secciones del álbum</h3>
              <p className="mt-1 text-sm text-gray-600">
                Define cómo se organizarán las figuritas. Puedes usar rangos, listas personalizadas o grupos con prefijos.
              </p>
            </div>

            {/* Input Mode Selector */}
            <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <button
                type="button"
                onClick={() => setInputMode('range')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  inputMode === 'range'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Por Rango
              </button>
              <button
                type="button"
                onClick={() => setInputMode('list')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  inputMode === 'list'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Lista Manual
              </button>
              <button
                type="button"
                onClick={() => setInputMode('groups')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  inputMode === 'groups'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Grupos / Prefijos
              </button>
            </div>

            {/* Input Content */}
            {inputMode === 'range' ? (
              <RangeForm
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                rangePrefix={rangePrefix}
                rangeCategory={rangeCategory}
                onStartChange={setRangeStart}
                onEndChange={setRangeEnd}
                onPrefixChange={setRangePrefix}
                onCategoryChange={setRangeCategory}
              />
            ) : inputMode === 'list' ? (
              <div className="space-y-3">
                <label htmlFor="stickerListText" className="block text-sm font-medium text-gray-700">
                  Lista de figuritas
                </label>
                <textarea
                  id="stickerListText"
                  value={stickerListText}
                  onChange={(event) => setStickerListText(event.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
                <p className="text-xs text-gray-500">
                  Formato: <code>numero|nombre|categoria</code> (una por línea). El nombre y categoría son opcionales.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="groupListText" className="block text-sm font-medium text-gray-700">
                  Grupos / Prefijos
                </label>
                <textarea
                  id="groupListText"
                  value={groupListText}
                  onChange={(event) => setGroupListText(event.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
                <p className="text-xs text-gray-500">
                  Ejemplos: <code>t1-20</code>, <code>e1-40</code>, <code>61-100</code>. Usa una línea por grupo o separa con comas.
                </p>
              </div>
            )}

            {/* Preview */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-900">
                📊 Previsualizando: <span className="text-primary-600">{stickerDrafts.length} figuritas</span>
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {stickerDrafts.slice(0, 6).map((sticker) => (
                  <div key={sticker.sticker_number} className="rounded px-2 py-1 bg-white text-xs text-gray-700">
                    <span className="font-semibold">#{sticker.sticker_number}</span> {sticker.name}
                  </div>
                ))}
                {stickerDrafts.length > 6 && (
                  <div className="rounded px-2 py-1 bg-white text-xs text-gray-500">
                    + {stickerDrafts.length - 6} más...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI Configuration - Placeholder */}
        {loadMethod === 'ai' && (
          <div className="rounded-xl bg-gradient-to-br from-primary-50 to-blue-50 p-8 shadow-md text-center">
            <p className="text-gray-600">
              La carga automática con IA estará disponible pronto. Por ahora, usa la configuración manual.
            </p>
          </div>
        )}

        {/* Errors */}
        {(formError || error) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError || error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => setCurrentStep('basic-info')}
            className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Atrás
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? '⏳ Creando álbum...' : '✅ Crear álbum y abrir colección'}
          </button>
        </div>
      </form>
    </div>
  )
}
