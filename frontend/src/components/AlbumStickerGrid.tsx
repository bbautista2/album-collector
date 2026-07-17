import { useMemo, useState } from 'react'
import type { Sticker, UserSticker } from '../types'

type ViewMode = 'all' | 'missing'

interface AlbumStickerGridProps {
  stickers: Sticker[]
  userStickers: Map<string, UserSticker>
}

export function AlbumStickerGrid({ stickers, userStickers }: AlbumStickerGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('all')

  const gridStats = useMemo(() => {
    const total = stickers.length
    const owned = stickers.filter((sticker) => (userStickers.get(sticker.id)?.quantity_owned || 0) > 0).length
    const missing = Math.max(0, total - owned)
    const visibleStickers =
      viewMode === 'missing'
        ? stickers.filter((sticker) => (userStickers.get(sticker.id)?.quantity_owned || 0) === 0)
        : stickers

    return { total, owned, missing, visibleStickers }
  }, [stickers, userStickers, viewMode])

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Grilla del álbum</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Visualiza tu progreso</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Marca visualmente las figuras obtenidas y filtra rápidamente solo las que te faltan.
          </p>
        </div>

        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setViewMode('all')}
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
            onClick={() => setViewMode('missing')}
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

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
        {gridStats.visibleStickers.map((sticker) => {
          const userSticker = userStickers.get(sticker.id)
          const owned = (userSticker?.quantity_owned || 0) > 0

          return (
            <div
              key={sticker.id}
              className={`group relative overflow-hidden rounded-2xl border p-3 transition-all duration-300 ${
                owned
                  ? 'border-slate-200 bg-slate-100/80 text-slate-400 opacity-80'
                  : 'border-amber-300 bg-white shadow-sm shadow-amber-100'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-[11px] uppercase tracking-[0.2em] ${owned ? 'text-slate-400' : 'text-amber-500'}`}>
                    {owned ? 'Obtenida' : 'Faltante'}
                  </p>
                  <p className={`mt-1 text-lg font-black ${owned ? 'text-slate-500' : 'text-slate-900'}`}>
                    #{sticker.sticker_number}
                  </p>
                </div>

                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    owned ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {owned ? '✓' : '!'}
                </div>
              </div>

              <p className={`mt-3 truncate text-xs font-medium ${owned ? 'text-slate-500' : 'text-slate-700'}`}>
                {sticker.name}
              </p>

              {sticker.category_or_team ? (
                <p className="mt-1 truncate text-[11px] text-slate-400">{sticker.category_or_team}</p>
              ) : null}

              {!owned ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-amber-300/70" /> : null}
            </div>
          )
        })}
      </div>

      {gridStats.visibleStickers.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No hay figuritas faltantes visibles con este filtro.
        </p>
      ) : null}
    </section>
  )
}