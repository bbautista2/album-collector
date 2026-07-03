import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { scanRepeatedStickers } from '../lib/repeatedScanner'
import type { Album, DetectedStickerNumber, Sticker, UserSticker } from '../types'

export function AlbumPage() {
  const { albumId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [album, setAlbum] = useState<Album | null>(null)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [userStickers, setUserStickers] = useState<Map<string, UserSticker>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanResults, setScanResults] = useState<DetectedStickerNumber[]>([])

  useEffect(() => {
    if (!user || !albumId) {
      navigate('/dashboard')
      return
    }

    const fetchData = async () => {
      setIsLoading(true)
      try {
        const { data: albumData } = await supabase
          .from('albums')
          .select('*')
          .eq('id', albumId)
          .single()

        if (albumData) {
          setAlbum(albumData)
        }

        // Fetch stickers for album
        const { data: stickersData } = await supabase
          .from('stickers')
          .select('*')
          .eq('album_id', albumId)
          .order('sticker_number', { ascending: true })

        if (stickersData) {
          setStickers(stickersData)
        }

        // Fetch user stickers
        const { data: userStickersData } = await supabase
          .from('user_stickers')
          .select('*')
          .eq('user_id', user.id)

        if (userStickersData) {
          const map = new Map()
          userStickersData.forEach((us) => {
            map.set(us.sticker_id, us)
          })
          setUserStickers(map)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user, albumId, navigate])

  const upsertStickerState = async (stickerId: string, quantityOwned: number, quantityRepeated: number) => {
    if (!user) {
      return
    }

    const safeOwned = Math.max(0, quantityOwned)
    const safeRepeated = Math.max(0, Math.min(quantityRepeated, safeOwned))

    const { error } = await supabase.from('user_stickers').upsert(
      {
        user_id: user.id,
        sticker_id: stickerId,
        quantity_owned: safeOwned,
        quantity_repeated: safeRepeated,
      },
      { onConflict: 'user_id,sticker_id' }
    )

    if (error) {
      throw error
    }

    const existing = userStickers.get(stickerId)
    const updated = new Map(userStickers)
    updated.set(stickerId, {
      id: existing?.id || '',
      user_id: user.id,
      sticker_id: stickerId,
      quantity_owned: safeOwned,
      quantity_repeated: safeRepeated,
      updated_at: new Date().toISOString(),
    })
    setUserStickers(updated)
  }

  const handleQuantityChange = async (stickerId: string, quantity: number) => {
    try {
      const existing = userStickers.get(stickerId)
      const repeated = Math.min(existing?.quantity_repeated || 0, Math.max(0, quantity || 0))
      await upsertStickerState(stickerId, quantity || 0, repeated)
    } catch (error) {
      console.error('Error updating sticker:', error)
    }
  }

  const handleRepeatedChange = async (stickerId: string, repeated: number) => {
    try {
      const existing = userStickers.get(stickerId)
      const owned = existing?.quantity_owned || 0
      await upsertStickerState(stickerId, owned, Math.min(repeated || 0, owned))
    } catch (error) {
      console.error('Error updating sticker:', error)
    }
  }

  const handleScanRepeated = async () => {
    if (!scanFile || !album || !user) {
      return
    }

    setScanLoading(true)
    setScanError(null)

    try {
      const response = await scanRepeatedStickers({
        file: scanFile,
        albumTitle: album.title,
        validStickerNumbers: stickers.map((sticker) => sticker.sticker_number),
      })

      const validResults = response.detectedNumbers.filter((item) => item.count > 0)
      setScanResults(validResults)

      if (validResults.length === 0) {
        return
      }

      const updates = validResults
        .map((item) => {
          const matchingSticker = stickers.find((sticker) => sticker.sticker_number === item.stickerNumber)

          if (!matchingSticker) {
            return null
          }

          const existing = userStickers.get(matchingSticker.id)
          const nextRepeated = (existing?.quantity_repeated || 0) + item.count
          const nextOwned = Math.max((existing?.quantity_owned || 0) + item.count, nextRepeated + 1)

          return {
            user_id: user.id,
            sticker_id: matchingSticker.id,
            quantity_owned: nextOwned,
            quantity_repeated: nextRepeated,
          }
        })
        .filter((item): item is { user_id: string; sticker_id: string; quantity_owned: number; quantity_repeated: number } => item !== null)

      if (updates.length === 0) {
        return
      }

      const { error } = await supabase.from('user_stickers').upsert(updates, { onConflict: 'user_id,sticker_id' })
      if (error) {
        throw error
      }

      const updated = new Map(userStickers)
      updates.forEach((update) => {
        const existing = userStickers.get(update.sticker_id)
        updated.set(update.sticker_id, {
          id: existing?.id || '',
          user_id: update.user_id,
          sticker_id: update.sticker_id,
          quantity_owned: update.quantity_owned,
          quantity_repeated: update.quantity_repeated,
          updated_at: new Date().toISOString(),
        })
      })
      setUserStickers(updated)
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'No se pudo procesar la imagen')
    } finally {
      setScanLoading(false)
    }
  }

  const ownedCount = Array.from(userStickers.values()).filter((us) => us.quantity_owned > 0)
    .length
  const totalCount = stickers.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{album?.title || 'Mi Colección'}</h1>
          {album?.description && <p className="mt-1 text-sm text-gray-600">{album.description}</p>}
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-primary-600 hover:text-primary-700"
        >
          ← Volver
        </button>
      </div>

      <div className="bg-primary-50 p-4 rounded-lg">
        <p className="text-sm text-gray-700">
          Has obtenido <strong>{ownedCount}</strong> de <strong>{totalCount}</strong> figuras (
          {totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0}%)
        </p>
      </div>

      <div className="rounded-lg border border-orange-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">Escaneo de repetidas con IA</h2>
            <p className="text-sm text-gray-600">
              Sube una foto de tus repetidas y Gemini intentará detectar los números para cargarlos al inventario.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setScanFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 md:w-auto"
            />
            <button
              onClick={handleScanRepeated}
              disabled={!scanFile || scanLoading}
              className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {scanLoading ? 'Analizando imagen...' : 'Escanear repetidas'}
            </button>
          </div>
        </div>

        {scanError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {scanError}
          </div>
        )}

        {scanResults.length > 0 && (
          <div className="mt-4 rounded-md bg-orange-50 px-4 py-3 text-sm text-orange-900">
            Detectadas: {scanResults.map((item) => `#${item.stickerNumber} × ${item.count}`).join(', ')}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Cargando figuras...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {stickers.map((sticker) => {
            const userSticker = userStickers.get(sticker.id)
            const owned = userSticker?.quantity_owned || 0
            const repeated = userSticker?.quantity_repeated || 0

            return (
              <div
                key={sticker.id}
                className={`p-4 rounded-lg border-2 transition ${
                  owned > 0
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="aspect-square bg-gray-100 rounded-md mb-2 flex items-center justify-center">
                  <span className="text-2xl">#{sticker.sticker_number}</span>
                </div>

                <p className="text-xs text-gray-600 mb-2 truncate">{sticker.name}</p>
                {sticker.category_or_team && (
                  <p className="text-xs text-primary-600 mb-2">{sticker.category_or_team}</p>
                )}

                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-600">
                      Tengo: <strong>{owned}</strong>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={owned}
                        onChange={(e) => handleQuantityChange(sticker.id, parseInt(e.target.value || '0', 10))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    />
                  </div>

                  {owned > 0 && (
                    <div>
                      <label className="text-xs text-gray-600">
                        Repetidas: <strong>{repeated}</strong>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={owned}
                        value={repeated}
                          onChange={(e) => handleRepeatedChange(sticker.id, parseInt(e.target.value || '0', 10))}
                        className="w-full px-2 py-1 border border-orange-300 rounded text-xs bg-orange-50"
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
