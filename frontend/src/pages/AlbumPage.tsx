import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { scanRepeatedStickers } from '../lib/repeatedScanner'
import { AlbumStickerGrid } from '../components/AlbumStickerGrid'
import type { Album, ExchangeCommitment, Sticker, UserSticker } from '../types'

type ScanMode = 'repeated' | 'missing'

interface ScannedStickerCandidate {
  key: string
  stickerId: string | null
  stickerNumber: number
  detectedPrefix: string
  displayCode: string
  displayName: string
  count: number
  selected: boolean
  mapped: boolean
}

export function AlbumPage() {
  const { albumId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const scanPanelRef = useRef<HTMLDivElement | null>(null)
  const [album, setAlbum] = useState<Album | null>(null)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [sections, setSections] = useState<import('../types').AlbumSection[]>([])
  const [userStickers, setUserStickers] = useState<Map<string, UserSticker>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanMode, setScanMode] = useState<ScanMode>('missing')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanCandidates, setScanCandidates] = useState<ScannedStickerCandidate[]>([])
  const [saveScanLoading, setSaveScanLoading] = useState(false)
  const [scanRawText, setScanRawText] = useState<string | null>(null)
  const [pendingCommitments, setPendingCommitments] = useState<ExchangeCommitment[]>([])
  const [commitmentActionLoadingId, setCommitmentActionLoadingId] = useState<string | null>(null)

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

        // Fetch sections and stickers grouped by section
        const { data: sectionsData } = await supabase
          .from('album_sections')
          .select('*')
          .eq('album_id', albumId)
          .order('id', { ascending: true })

        if (sectionsData) {
          setSections(sectionsData)
          const sectionIds = sectionsData.map((s: any) => s.id)
          const { data: stickersData } = await supabase
            .from('stickers')
            .select('*')
            .in('section_id', sectionIds)
            .order('sticker_number', { ascending: true })

          if (stickersData) {
            setStickers(stickersData)
          }
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

        const { data: commitmentsData } = await supabase
          .from('exchange_commitments')
          .select('*')
          .eq('created_by', user.id)
          .eq('album_id', albumId)
          .eq('direction', 'incoming')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (commitmentsData) {
          setPendingCommitments(commitmentsData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user, albumId, navigate])

  useEffect(() => {
    if (searchParams.get('scan') === '1') {
      setScanMode('missing')
      requestAnimationFrame(() => {
        scanPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [searchParams])

  const mapStickerCandidate = (prefix: string, number: number): ScannedStickerCandidate | null => {
    const normalizedPrefix = (prefix || '').trim().toLowerCase()
    const section = sections.find((s) => (s.prefix || '').trim().toLowerCase() === normalizedPrefix)

    let sticker: Sticker | undefined

    if (section) {
      sticker = stickers.find((st) => st.section_id === section.id && st.sticker_number === number)
    }

    if (!sticker) {
      const byNumber = stickers.filter((st) => st.sticker_number === number)
      if (byNumber.length === 1) {
        sticker = byNumber[0]
      } else if (byNumber.length > 1 && normalizedPrefix) {
        sticker = byNumber.find((st) => st.name.toLowerCase().startsWith(normalizedPrefix))
      }
    }

    const displayCode = `${prefix || ''}${number}`

    if (!sticker) {
      return {
        key: `${normalizedPrefix}:${number}`,
        stickerId: null,
        stickerNumber: number,
        detectedPrefix: prefix || '',
        displayCode,
        displayName: `Figurita ${displayCode}`,
        count: 1,
        selected: true,
        mapped: false,
      }
    }

    return {
      key: sticker.id,
      stickerId: sticker.id,
      stickerNumber: sticker.sticker_number,
      detectedPrefix: prefix || '',
      displayCode,
      displayName: sticker.name,
      count: 1,
      selected: true,
      mapped: true,
    }
  }

  const ensureMappedSelectedCandidates = async (
    candidates: ScannedStickerCandidate[]
  ): Promise<ScannedStickerCandidate[]> => {
    if (!albumId || !user || !album) {
      return candidates
    }

    const selectedUnmapped = candidates.filter((candidate) => candidate.selected && !candidate.mapped)
    if (selectedUnmapped.length === 0) {
      return candidates
    }

    if (album.created_by !== user.id) {
      throw new Error(
        'Este álbum no tiene catálogo de figuritas y solo el creador puede inicializarlo automáticamente.'
      )
    }

    let nextSections = [...sections]
    let nextStickers = [...stickers]
    const sectionByPrefix = new Map(
      nextSections.map((section) => [(section.prefix || '').trim().toLowerCase(), section])
    )

    const requiredPrefixes = Array.from(
      new Set(selectedUnmapped.map((candidate) => (candidate.detectedPrefix || '').trim().toLowerCase()))
    )

    for (const normalizedPrefix of requiredPrefixes) {
      if (sectionByPrefix.has(normalizedPrefix)) {
        continue
      }

      const rawPrefix = selectedUnmapped.find(
        (candidate) => (candidate.detectedPrefix || '').trim().toLowerCase() === normalizedPrefix
      )?.detectedPrefix || ''

      const sectionName = rawPrefix.trim()
        ? `Sección ${rawPrefix.trim()}`
        : 'Sección Principal'

      const { data: newSection, error: sectionError } = await supabase
        .from('album_sections')
        .insert({
          album_id: albumId,
          name: sectionName,
          prefix: rawPrefix,
          total_stickers: 0,
        })
        .select('*')
        .single()

      if (sectionError) {
        throw sectionError
      }

      if (newSection) {
        nextSections = [...nextSections, newSection]
        sectionByPrefix.set((newSection.prefix || '').trim().toLowerCase(), newSection)
      }
    }

    const groupedByPrefix = new Map<string, ScannedStickerCandidate[]>()
    selectedUnmapped.forEach((candidate) => {
      const key = (candidate.detectedPrefix || '').trim().toLowerCase()
      const current = groupedByPrefix.get(key) || []
      groupedByPrefix.set(key, [...current, candidate])
    })

    for (const [normalizedPrefix, groupCandidates] of groupedByPrefix.entries()) {
      const section = sectionByPrefix.get(normalizedPrefix)
      if (!section) {
        continue
      }

      const numbersToEnsure = Array.from(new Set(groupCandidates.map((candidate) => candidate.stickerNumber)))

      const existingInSection = nextStickers.filter(
        (sticker) => sticker.section_id === section.id && numbersToEnsure.includes(sticker.sticker_number)
      )
      const existingNumberSet = new Set(existingInSection.map((sticker) => sticker.sticker_number))
      const missingNumbers = numbersToEnsure.filter((number) => !existingNumberSet.has(number))

      if (missingNumbers.length > 0) {
        const rowsToInsert = missingNumbers.map((number) => ({
          section_id: section.id,
          sticker_number: number,
          name: section.prefix ? `${section.prefix}${number}` : `Sticker ${number}`,
          category_or_team: null,
        }))

        const { data: insertedStickers, error: insertError } = await supabase
          .from('stickers')
          .insert(rowsToInsert)
          .select('*')

        if (insertError) {
          throw insertError
        }

        if (insertedStickers && insertedStickers.length > 0) {
          nextStickers = [...nextStickers, ...insertedStickers]
        }

        await supabase
          .from('album_sections')
          .update({ total_stickers: nextStickers.filter((sticker) => sticker.section_id === section.id).length })
          .eq('id', section.id)
      }
    }

    const remappedCandidates = candidates.map((candidate) => {
      if (!candidate.selected || candidate.mapped) {
        return candidate
      }

      const normalizedPrefix = (candidate.detectedPrefix || '').trim().toLowerCase()
      const section = sectionByPrefix.get(normalizedPrefix)
      if (!section) {
        return candidate
      }

      const sticker = nextStickers.find(
        (item) => item.section_id === section.id && item.sticker_number === candidate.stickerNumber
      )

      if (!sticker) {
        return candidate
      }

      return {
        ...candidate,
        key: sticker.id,
        stickerId: sticker.id,
        displayName: sticker.name,
        mapped: true,
      }
    })

    setSections(nextSections)
    setStickers(nextStickers)

    return remappedCandidates
  }

  const resetScanPreview = () => {
    setScanCandidates([])
    setScanError(null)
    setScanRawText(null)
    setScanFile(null)
  }

  const toggleScanCandidate = (key: string) => {
    setScanCandidates((current) =>
      current.map((candidate) =>
        candidate.key === key
          ? {
              ...candidate,
              selected: !candidate.selected,
            }
          : candidate
      )
    )
  }

  const saveSelectedScanCandidates = async () => {
    if (!user) {
      return
    }

    setSaveScanLoading(true)
    setScanError(null)

    try {
      const selectedCandidates = scanCandidates.filter((candidate) => candidate.selected)
      if (selectedCandidates.length === 0) {
        setScanError('No hay figuritas seleccionadas para guardar.')
        return
      }

      const remappedCandidates = await ensureMappedSelectedCandidates(scanCandidates)
      setScanCandidates(remappedCandidates)

      const selectedMapped = remappedCandidates.filter(
        (candidate) => candidate.selected && candidate.mapped && candidate.stickerId
      )

      if (selectedMapped.length === 0) {
        setScanError('No hay figuritas mapeadas para guardar en la base de datos.')
        return
      }

      const updates = selectedMapped.map((candidate) => {
        const stickerId = candidate.stickerId as string
        const existing = userStickers.get(stickerId)

        if (scanMode === 'missing') {
          const nextOwned = Math.max(existing?.quantity_owned || 0, 0) + candidate.count
          return {
            user_id: user.id,
            sticker_id: stickerId,
            quantity_owned: nextOwned,
            quantity_repeated: Math.min(existing?.quantity_repeated || 0, nextOwned),
          }
        }

        const nextRepeated = (existing?.quantity_repeated || 0) + candidate.count
        const nextOwned = Math.max((existing?.quantity_owned || 0) + candidate.count, nextRepeated + 1)

        return {
          user_id: user.id,
          sticker_id: stickerId,
          quantity_owned: nextOwned,
          quantity_repeated: nextRepeated,
        }
      })

      const { error } = await supabase.from('user_stickers').upsert(updates, {
        onConflict: 'user_id,sticker_id',
      })

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

      setScanCandidates([])
      setScanFile(null)
      setScanRawText(null)
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'No se pudo guardar el resultado del escaneo')
    } finally {
      setSaveScanLoading(false)
    }
  }

  const handleScanRepeated = async () => {
    if (!scanFile || !album || !user) {
      return
    }

    resetScanPreview()
    setScanLoading(true)
    setScanError(null)

    try {
      const response = await scanRepeatedStickers({
        file: scanFile,
        albumTitle: album.title,
        validStickerNumbers: stickers.map((sticker) => sticker.sticker_number),
        albumId: albumId,
      })

      // Save rawText for debugging if present
      if (response.rawText) {
        setScanRawText(response.rawText)
      } else {
        setScanRawText(null)
      }

      // If the function returned grouped missing_by_prefix, build preview candidates
      if (response.missingByPrefix && response.missingByPrefix.length > 0) {
        const candidateMap = new Map<string, ScannedStickerCandidate>()
        response.missingByPrefix.forEach((group) => {
          const prefix = group.prefix || ''
          group.numbers.forEach((num) => {
            const candidate = mapStickerCandidate(prefix, num)
            if (!candidate) {
              return
            }

            const existingCandidate = candidateMap.get(candidate.key)
            if (!existingCandidate) {
              candidateMap.set(candidate.key, candidate)
              return
            }

            candidateMap.set(candidate.key, {
              ...existingCandidate,
              count: existingCandidate.count + 1,
            })
          })
        })

        const previewCandidates = Array.from(candidateMap.values()).sort(
          (a, b) => a.stickerNumber - b.stickerNumber
        )

        if (previewCandidates.length === 0) {
          setScanError('No se detectaron figuritas para mapear en la imagen')
          return
        }

        setScanCandidates(previewCandidates)
        return
      }

      // Backwards-compatible flow: flat detectedNumbers -> preview candidates
      const validResults = response.detectedNumbers.filter((item) => item.count > 0)

      if (validResults.length === 0) {
        setScanError('No se detectaron figuritas en la imagen')
        return
      }

      const previewCandidates = validResults
        .map((item) => {
          const candidate = mapStickerCandidate('', item.stickerNumber)
          if (!candidate) return null
          return {
            ...candidate,
            count: item.count,
          }
        })
        .filter((item): item is ScannedStickerCandidate => item !== null)

      if (previewCandidates.length === 0) {
        setScanError('No se detectaron figuritas mapeables en la imagen')
        return
      }

      setScanCandidates(previewCandidates)
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'No se pudo procesar la imagen')
    } finally {
      setScanLoading(false)
    }
  }

  const handleCompleteCommitment = async (commitment: ExchangeCommitment) => {
    if (!user) {
      return
    }

    setCommitmentActionLoadingId(commitment.id)
    try {
      const existing = userStickers.get(commitment.sticker_id)
      const nextOwned = (existing?.quantity_owned || 0) + 1
      const nextRepeated = Math.min(existing?.quantity_repeated || 0, nextOwned)

      const { error: stickerError } = await supabase.from('user_stickers').upsert(
        {
          user_id: user.id,
          sticker_id: commitment.sticker_id,
          quantity_owned: nextOwned,
          quantity_repeated: nextRepeated,
        },
        { onConflict: 'user_id,sticker_id' }
      )

      if (stickerError) {
        throw stickerError
      }

      const { error: commitmentError } = await supabase
        .from('exchange_commitments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', commitment.id)

      if (commitmentError) {
        throw commitmentError
      }

      const updated = new Map(userStickers)
      updated.set(commitment.sticker_id, {
        id: existing?.id || '',
        user_id: user.id,
        sticker_id: commitment.sticker_id,
        quantity_owned: nextOwned,
        quantity_repeated: nextRepeated,
        updated_at: new Date().toISOString(),
      })
      setUserStickers(updated)
      setPendingCommitments((previous) => previous.filter((item) => item.id !== commitment.id))
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'No se pudo completar el intercambio')
    } finally {
      setCommitmentActionLoadingId(null)
    }
  }

  const ownedCount = useMemo(
    () => Array.from(userStickers.values()).filter((us) => us.quantity_owned > 0).length,
    [userStickers]
  )
  const totalCount = stickers.length
  const scanActionLabel = scanMode === 'missing' ? 'Escanear faltantes' : 'Escanear repetidas'
  const scanModeHint =
    scanMode === 'missing'
      ? 'Escanea tu grilla para registrar las figuritas que ya conseguiste y visualizar las faltantes.'
      : 'Escanea una foto de tus repetidas para actualizar tu inventario automáticamente.'
  const selectedCandidateCount = scanCandidates.filter((candidate) => candidate.selected).length
  const unmappedCandidateCount = scanCandidates.filter((candidate) => !candidate.mapped).length

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

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-gray-700">
          Has obtenido <strong>{ownedCount}</strong> de <strong>{totalCount}</strong> figuras (
          {totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0}%)
        </p>
      </div>

      <div ref={scanPanelRef} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">Escanear mis figuras faltantes</h2>
            <p className="text-sm text-gray-600">
              {scanModeHint}
            </p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setScanFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 md:w-auto"
            />
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <button
                onClick={handleScanRepeated}
                disabled={!scanFile || scanLoading}
                className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanLoading ? 'Analizando imagen...' : scanActionLabel}
              </button>
              <button
                onClick={resetScanPreview}
                disabled={scanLoading || saveScanLoading}
                className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Volver a escanear
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setScanMode('repeated')}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              scanMode === 'repeated'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Ver repetidas
          </button>
          <button
            onClick={() => setScanMode('missing')}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              scanMode === 'missing'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Ver faltantes
          </button>
        </div>

        {scanError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {scanError}
          </div>
        )}

        {scanCandidates.length > 0 && (
          <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Figuritas detectadas: {scanCandidates.length}
                </p>
                <p className="text-xs text-slate-500">
                  Seleccionadas para guardar: {selectedCandidateCount}
                  {unmappedCandidateCount > 0 ? ` · Sin mapeo: ${unmappedCandidateCount}` : ''}
                </p>
              </div>

              <button
                onClick={saveSelectedScanCandidates}
                disabled={selectedCandidateCount === 0 || saveScanLoading}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveScanLoading ? 'Guardando...' : 'Confirmar y guardar'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {scanCandidates.map((candidate) => (
                <label
                  key={candidate.key}
                  className={`cursor-pointer rounded-xl border p-3 transition ${
                    candidate.selected
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {candidate.mapped ? 'Mapeada' : 'Sin mapeo'}
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-900">#{candidate.stickerNumber}</p>
                      <p className="text-xs text-slate-500">{candidate.displayCode}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={candidate.selected}
                      onChange={() => toggleScanCandidate(candidate.key)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600"
                    />
                  </div>

                  <p className="mt-2 truncate text-xs text-slate-700">{candidate.displayName}</p>
                  {candidate.count > 1 ? (
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">Detectada × {candidate.count}</p>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
        )}

        {scanRawText && (
          <div className="mt-4 rounded-md bg-gray-50 px-4 py-3 text-xs text-gray-700">
            <div className="font-semibold text-gray-800 mb-1">Texto crudo del procesador (para depuración)</div>
            <pre className="whitespace-pre-wrap break-words max-h-40 overflow-auto">{scanRawText}</pre>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Intercambios pendientes por confirmar</h2>
        <p className="mt-1 text-sm text-gray-600">
          Cuando completes un intercambio, márcalo aquí y la figurita quedará registrada como obtenida automáticamente.
        </p>

        {pendingCommitments.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No tienes intercambios pendientes en este álbum.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {pendingCommitments.map((commitment) => {
              const sticker = stickers.find((item) => item.id === commitment.sticker_id)
              return (
                <div
                  key={commitment.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {sticker ? `#${sticker.sticker_number} · ${sticker.name}` : commitment.sticker_id}
                    </p>
                    <p className="text-xs text-gray-500">Pendiente desde {new Date(commitment.created_at).toLocaleDateString()}</p>
                  </div>

                  <button
                    onClick={() => handleCompleteCommitment(commitment)}
                    disabled={commitmentActionLoadingId === commitment.id}
                    className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {commitmentActionLoadingId === commitment.id ? 'Completando...' : 'Marcar intercambio completado'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Cargando figuras...</div>
      ) : (
        <AlbumStickerGrid stickers={stickers} userStickers={userStickers} />
      )}
    </div>
  )
}
