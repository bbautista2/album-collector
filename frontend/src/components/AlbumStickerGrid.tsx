import { useMemo, useState } from 'react'
import type { Sticker, UserSticker } from '../types'

const PAGE_SIZE = 50

type ViewMode = 'all' | 'missing'

interface AlbumStickerGridProps {
  stickers: Sticker[]
  userStickers: Map<string, UserSticker>
}

export function AlbumStickerGrid({ stickers, userStickers }: AlbumStickerGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [page, setPage] = useState(0)

  const gridStats = useMemo(() => {
    const total = stickers.length
    const owned = stickers.filter((sticker) => (userStickers.get(sticker.id)?.quantity_owned || 0) > 0).length
    const missing = stickers.filter((sticker) => {
      const userSticker = userStickers.get(sticker.id)
      return !!userSticker && (userSticker.quantity_owned || 0) === 0
    }).length
    const unknown = Math.max(0, total - owned - missing)
    const visibleStickers =
      viewMode === 'missing'
        ? stickers.filter((sticker) => {
            const userSticker = userStickers.get(sticker.id)
            return !!userSticker && (userSticker.quantity_owned || 0) === 0
          })
        : stickers

    return { total, owned, missing, unknown, visibleStickers }
  }, [stickers, userStickers, viewMode])

  const hasAnyAlbumData = useMemo(
    () => stickers.some((sticker) => userStickers.has(sticker.id)),
    [stickers, userStickers],
  )

  const totalPages = Math.max(1, Math.ceil(gridStats.visibleStickers.length / PAGE_SIZE))
  const paginatedStickers = gridStats.visibleStickers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    setPage(0)
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Grilla del álbum</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Visualiza tu progreso</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Las faltantes se muestran cuando ya fueron escaneadas para este usuario.
          </p>
        </div>

        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => handleViewModeChange('all')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              viewMode === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Ver Todo
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange('missing')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              viewMode === 'missing'
                ? 'bg-amber-100 text-amber-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Ver Faltantes
          </button>
        </div>
      </div>

      {hasAnyAlbumData ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Total</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{gridStats.total}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-emerald-500">Obtenidas</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{gridStats.owned}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-amber-500">Faltantes</p>
              <p className="mt-1 text-2xl font-bold text-amber-700">{gridStats.missing}</p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Sin escanear</p>
              <p className="mt-1 text-2xl font-bold text-slate-700">{gridStats.unknown}</p>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
              <p className="text-xs text-slate-500">
                Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, gridStats.visibleStickers.length)} de{' '}
                {gridStats.visibleStickers.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-500">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {paginatedStickers.map((sticker) => {
              const userSticker = userStickers.get(sticker.id)
              const repeated = (userSticker?.quantity_repeated || 0) > 0
              const owned = !repeated && (userSticker?.quantity_owned || 0) > 0
              const missing = !repeated && !owned && !!userSticker && (userSticker.quantity_owned || 0) === 0

              const cardStyle = repeated
                ? 'border-violet-200 bg-violet-50/80 text-violet-700'
                : owned
                  ? 'border-slate-200 bg-slate-100/80 text-slate-400 opacity-80'
                  : missing
                    ? 'border-amber-300 bg-white shadow-sm shadow-amber-100'
                    : 'border-slate-200 bg-white text-slate-700'

              const tagStyle = repeated
                ? 'text-violet-500'
                : owned
                  ? 'text-slate-400'
                  : missing
                    ? 'text-amber-500'
                    : 'text-slate-500'

              const numberStyle = repeated
                ? 'text-violet-900'
                : owned
                  ? 'text-slate-500'
                  : missing
                    ? 'text-slate-900'
                    : 'text-slate-700'

              const iconStyle = repeated
                ? 'bg-violet-100 text-violet-700'
                : owned
                  ? 'bg-emerald-100 text-emerald-700'
                  : missing
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-500'

              const icon = repeated ? '↻' : owned ? '✓' : missing ? '!' : '·'
              const statusLabel = repeated ? 'Repetida' : owned ? 'Obtenida' : missing ? 'Faltante' : 'Sin escanear'

              return (
                <div
                  key={sticker.id}
                  className={`group relative overflow-hidden rounded-2xl border p-3 transition-all duration-300 ${cardStyle}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-[11px] uppercase tracking-[0.2em] ${tagStyle}`}>
                        {statusLabel}
                      </p>
                      <p className={`mt-1 text-lg font-black ${numberStyle}`}>
                        #{sticker.sticker_number}
                      </p>
                    </div>

                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${iconStyle}`}
                    >
                      {icon}
                    </div>
                  </div>

                  <p className={`mt-3 truncate text-xs font-medium ${repeated ? 'text-violet-700' : owned ? 'text-slate-500' : missing ? 'text-slate-700' : 'text-slate-600'}`}>
                    {sticker.name}
                  </p>

                  {sticker.category_or_team ? (
                    <p className="mt-1 truncate text-[11px] text-slate-400">{sticker.category_or_team}</p>
                  ) : null}

                  {missing ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-amber-300/70" /> : null}
                </div>
              )
            })}
          </div>

          {paginatedStickers.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              {viewMode === 'missing'
                ? 'No hay figuritas faltantes escaneadas para este álbum.'
                : 'No hay figuritas en este álbum.'}
            </p>
          ) : null}
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <p className="text-lg font-semibold text-slate-700">
            Este álbum está vacío
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Usa el escáner de arriba para registrar tus primeras figuritas. No hay nada que mostrar todavía.
          </p>
        </div>
      )}
    </section>
  )
}