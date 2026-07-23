import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { ExchangeNotification, Sticker, Album } from '../types'

export function ExchangeInboxPage() {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState<ExchangeNotification[]>([])
  const [stickers, setStickers] = useState<Map<string, Sticker>>(new Map())
  const [albums, setAlbums] = useState<Map<string, Album>>(new Map())
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      setIsLoading(true)
      try {
        const { data: notifData } = await supabase
          .from('exchange_notifications')
          .select('*')
          .or(`to_user_id.eq.${user.id},from_user_id.eq.${user.id}`)
          .order('created_at', { ascending: false })

        if (notifData) setNotifications(notifData as ExchangeNotification[])

        const stickerIds = new Set(notifData?.map((n) => n.sticker_id) || [])
        const albumIds = new Set(notifData?.map((n) => n.album_id) || [])
        const userIds = new Set<string>()
        notifData?.forEach((n) => { userIds.add(n.from_user_id); userIds.add(n.to_user_id) })

        if (stickerIds.size > 0) {
          const { data: sData } = await supabase.from('stickers').select('*').in('id', Array.from(stickerIds))
          if (sData) setStickers(new Map(sData.map((s) => [s.id, s])))
        }

        if (albumIds.size > 0) {
          const { data: aData } = await supabase.from('albums').select('*').in('id', Array.from(albumIds))
          if (aData) setAlbums(new Map(aData.map((a) => [a.id, a])))
        }

        if (userIds.size > 0) {
          const { data: pData } = await supabase.from('profiles').select('id, username').in('id', Array.from(userIds))
          if (pData) setProfiles(new Map(pData.map((p) => [p.id, p.username])))
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user])

  const handleUpdateStatus = async (id: string, status: 'accepted' | 'rejected') => {
    setActionLoading(id)
    try {
      const { error } = await supabase
        .from('exchange_notifications')
        .update({ status, read_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status, read_at: new Date().toISOString() } : n))
      )
    } catch {
      // silent
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkRead = async (id: string) => {
    const notif = notifications.find((n) => n.id === id)
    if (!notif || notif.read_at) return

    const { error } = await supabase
      .from('exchange_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      )
    }
  }

  const incoming = useMemo(
    () =>
      notifications
        .filter((n) => n.to_user_id === user?.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notifications, user]
  )

  const sent = useMemo(
    () =>
      notifications
        .filter((n) => n.from_user_id === user?.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notifications, user]
  )

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Cargando buzón...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Buzón de intercambios</h1>

      {/* Recibidas */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Solicitudes recibidas</h2>

        {incoming.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No tienes solicitudes de intercambio recibidas.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {incoming.map((notif) => {
              const sticker = stickers.get(notif.sticker_id)
              const album = albums.get(notif.album_id)
              const fromUsername = profiles.get(notif.from_user_id) || 'Desconocido'
              const isPending = notif.status === 'pending'

              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.read_at && handleMarkRead(notif.id)}
                  className={`rounded-2xl border p-4 transition ${
                    isPending
                      ? 'border-violet-300 bg-violet-50'
                      : notif.status === 'accepted'
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50'
                  } ${!notif.read_at && isPending ? 'ring-2 ring-violet-200' : ''}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        <span className="text-violet-600">{fromUsername}</span> quiere intercambiar
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Te ofrece{' '}
                        <strong>
                          #{sticker?.sticker_number} {sticker?.name}
                        </strong>{' '}
                        del álbum <strong>{album?.title || 'Desconocido'}</strong>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {notif.status === 'pending' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(notif.id, 'accepted') }}
                            disabled={actionLoading === notif.id}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {actionLoading === notif.id ? '...' : 'Aceptar'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(notif.id, 'rejected') }}
                            disabled={actionLoading === notif.id}
                            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {notif.status === 'accepted' && (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Aceptada
                        </span>
                      )}
                      {notif.status === 'rejected' && (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                          Rechazada
                        </span>
                      )}
                      {notif.status === 'cancelled' && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                          Cancelada
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Enviadas */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Solicitudes enviadas</h2>

        {sent.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No has enviado solicitudes de intercambio.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {sent.map((notif) => {
              const sticker = stickers.get(notif.sticker_id)
              const album = albums.get(notif.album_id)
              const toUsername = profiles.get(notif.to_user_id) || 'Desconocido'

              return (
                <div
                  key={notif.id}
                  className={`rounded-2xl border p-4 ${
                    notif.status === 'pending'
                      ? 'border-amber-200 bg-amber-50'
                      : notif.status === 'accepted'
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Solicitaste a <span className="text-amber-600">{toUsername}</span>
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Figurita{' '}
                        <strong>
                          #{sticker?.sticker_number} {sticker?.name}
                        </strong>{' '}
                        · Álbum <strong>{album?.title || 'Desconocido'}</strong>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      {notif.status === 'pending' && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          Pendiente
                        </span>
                      )}
                      {notif.status === 'accepted' && (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Aceptada
                        </span>
                      )}
                      {notif.status === 'rejected' && (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                          Rechazada
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
