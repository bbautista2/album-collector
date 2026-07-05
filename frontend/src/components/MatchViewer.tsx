import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

interface MatchViewerProps {
  albumId: string
  profileId: string
}

interface MatchSticker {
  id: string
  number: number
  name: string
}

interface MatchmakingResult {
  stickers_for_a: MatchSticker[]
  stickers_for_b: MatchSticker[]
}

interface StickerListProps {
  title: string
  items: MatchSticker[]
  saveLabel: string
  onSave: (sticker: MatchSticker) => Promise<void>
  savedStickerIds: Set<string>
  isSaving: boolean
}

function StickerList({
  title,
  items,
  saveLabel,
  onSave,
  savedStickerIds,
  isSaving,
}: StickerListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="mb-3 text-sm font-semibold text-gray-700">{title}</h4>
        <p className="text-sm text-gray-500">Sin coincidencias por ahora.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h4 className="mb-3 text-sm font-semibold text-gray-700">{title}</h4>
      <ul className="space-y-2">
        {items.map((sticker) => {
          const isSaved = savedStickerIds.has(sticker.id)

          return (
            <li
              key={sticker.id}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-primary-700">#{sticker.number}</span>
                <span className="ml-3 flex-1 truncate text-sm text-gray-700">{sticker.name}</span>
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => onSave(sticker)}
                  disabled={isSaved || isSaving}
                  className="rounded-md border border-primary-300 px-3 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaved ? 'Pendiente guardado' : saveLabel}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function MatchViewer({ albumId, profileId }: MatchViewerProps) {
  const { user } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedStickerIds, setSavedStickerIds] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<MatchmakingResult>({
    stickers_for_a: [],
    stickers_for_b: [],
  })

  const saveCommitment = async (sticker: MatchSticker, direction: 'incoming' | 'outgoing') => {
    if (!user?.id) {
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const { error: insertError } = await supabase.from('exchange_commitments').insert({
        created_by: user.id,
        counterparty_id: profileId,
        album_id: albumId,
        sticker_id: sticker.id,
        direction,
        status: 'pending',
      })

      if (insertError) {
        throw insertError
      }

      setSavedStickerIds((previous) => {
        const next = new Set(previous)
        next.add(sticker.id)
        return next
      })
    } catch (saveCommitmentError) {
      setSaveError(
        saveCommitmentError instanceof Error
          ? saveCommitmentError.message
          : 'No se pudo guardar el intercambio pendiente'
      )
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    const fetchMatchmaking = async () => {
      if (!user?.id || !albumId || !profileId) {
        if (isMounted) {
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)
      setError(null)

      const { data, error: rpcError } = await supabase.rpc('get_album_matchmaking', {
        p_user_a: user.id,
        p_user_b: profileId,
        p_album_id: albumId,
      })

      if (!isMounted) {
        return
      }

      if (rpcError) {
        setError(rpcError.message)
        setIsLoading(false)
        return
      }

      const parsed = (data || {}) as Partial<MatchmakingResult>

      setResult({
        stickers_for_a: Array.isArray(parsed.stickers_for_a) ? parsed.stickers_for_a : [],
        stickers_for_b: Array.isArray(parsed.stickers_for_b) ? parsed.stickers_for_b : [],
      })
      setIsLoading(false)
    }

    fetchMatchmaking()

    return () => {
      isMounted = false
    }
  }, [albumId, profileId, user?.id])

  const hasExchangeMatch = useMemo(
    () => result.stickers_for_a.length > 0 && result.stickers_for_b.length > 0,
    [result]
  )

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Buscando posibles intercambios...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-sm text-red-700">No se pudo cargar el matchmaking: {error}</p>
      </div>
    )
  }

  const noMatches = result.stickers_for_a.length === 0 && result.stickers_for_b.length === 0

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-gray-900">Matchmaking de Intercambio</h3>
        {hasExchangeMatch && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
            ¡Match de Intercambio Disponible!
          </span>
        )}
      </div>

      {noMatches && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Por ahora no hay cruces de intercambio para este álbum. Vuelve a intentarlo más tarde.
        </div>
      )}

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <StickerList
          title="Figuritas que te puede dar"
          items={result.stickers_for_a}
          saveLabel="Guardar pendiente (me la dan)"
          onSave={(sticker) => saveCommitment(sticker, 'incoming')}
          savedStickerIds={savedStickerIds}
          isSaving={isSaving}
        />

        <StickerList
          title="Figuritas que le puedes dar"
          items={result.stickers_for_b}
          saveLabel="Guardar pendiente (yo la doy)"
          onSave={(sticker) => saveCommitment(sticker, 'outgoing')}
          savedStickerIds={savedStickerIds}
          isSaving={isSaving}
        />
      </div>
    </section>
  )
}
