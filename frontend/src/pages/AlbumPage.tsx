import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import type { Sticker, UserSticker } from '../types'

export function AlbumPage() {
  const { albumId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [userStickers, setUserStickers] = useState<Map<string, UserSticker>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user || !albumId) {
      navigate('/dashboard')
      return
    }

    const fetchData = async () => {
      setIsLoading(true)
      try {
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

  const handleQuantityChange = async (stickerId: string, quantity: number) => {
    if (!user) return

    try {
      const existing = userStickers.get(stickerId)
      const repeated = existing?.quantity_repeated || 0

      const { error } = await supabase.from('user_stickers').upsert({
        user_id: user.id,
        sticker_id: stickerId,
        quantity_owned: quantity,
        quantity_repeated: repeated,
      })

      if (error) throw error

      // Update local state
      const updated = new Map(userStickers)
      updated.set(stickerId, {
        id: existing?.id || '',
        user_id: user.id,
        sticker_id: stickerId,
        quantity_owned: quantity,
        quantity_repeated: repeated,
        updated_at: new Date().toISOString(),
      })
      setUserStickers(updated)
    } catch (error) {
      console.error('Error updating sticker:', error)
    }
  }

  const handleRepeatedChange = async (stickerId: string, repeated: number) => {
    if (!user) return

    try {
      const existing = userStickers.get(stickerId)
      const owned = existing?.quantity_owned || 0

      const { error } = await supabase.from('user_stickers').upsert({
        user_id: user.id,
        sticker_id: stickerId,
        quantity_owned: owned,
        quantity_repeated: repeated,
      })

      if (error) throw error

      // Update local state
      const updated = new Map(userStickers)
      updated.set(stickerId, {
        id: existing?.id || '',
        user_id: user.id,
        sticker_id: stickerId,
        quantity_owned: owned,
        quantity_repeated: repeated,
        updated_at: new Date().toISOString(),
      })
      setUserStickers(updated)
    } catch (error) {
      console.error('Error updating sticker:', error)
    }
  }

  const ownedCount = Array.from(userStickers.values()).filter((us) => us.quantity_owned > 0)
    .length
  const totalCount = stickers.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Mi Colección</h1>
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
                      onChange={(e) => handleQuantityChange(sticker.id, parseInt(e.target.value))}
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
                        onChange={(e) => handleRepeatedChange(sticker.id, parseInt(e.target.value))}
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
