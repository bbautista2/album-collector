import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MatchViewer } from '../components/MatchViewer'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Album } from '../types'

interface PublicProfileData {
  id: string
  username: string
  full_name: string | null
  city: string | null
  country: string | null
  is_public: boolean
}

export function PublicProfilePage() {
  const { profileId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [profile, setProfile] = useState<PublicProfileData | null>(null)
  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !profileId) {
      navigate('/dashboard')
      return
    }

    const loadData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, city, country, is_public')
          .eq('id', profileId)
          .single()

        if (profileError) {
          throw new Error('No fue posible abrir este perfil. Puede ser privado o no existir.')
        }

        setProfile(profileData)

        const { data: myAlbumsRows, error: myAlbumsError } = await supabase
          .from('user_albums')
          .select('album_id')
          .eq('user_id', user.id)

        if (myAlbumsError) {
          throw myAlbumsError
        }

        const myAlbumIds = (myAlbumsRows || []).map((row) => row.album_id)

        if (myAlbumIds.length === 0) {
          setAlbums([])
          setSelectedAlbumId('')
          return
        }

        const { data: albumData, error: albumsError } = await supabase
          .from('albums')
          .select('*')
          .in('id', myAlbumIds)
          .order('title', { ascending: true })

        if (albumsError) {
          throw albumsError
        }

        setAlbums(albumData || [])
        setSelectedAlbumId((albumData && albumData[0]?.id) || '')
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Error cargando perfil'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [navigate, profileId, user])

  const isSelfProfile = useMemo(() => user?.id === profileId, [profileId, user?.id])

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cargando perfil público...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-primary-600 hover:text-primary-700"
        >
          ← Volver
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    )
  }

  if (isSelfProfile) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <button
          onClick={() => navigate('/profile')}
          className="text-primary-600 hover:text-primary-700"
        >
          ← Ir a mi perfil
        </button>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Este es tu propio perfil. Usa la sección de matchmaking visitando el perfil de otro coleccionista.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/dashboard')}
        className="text-primary-600 hover:text-primary-700"
      >
        ← Volver
      </button>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">
          Perfil de {profile?.full_name || profile?.username || 'Coleccionista'}
        </h1>
        <p className="mt-2 text-gray-600">@{profile?.username}</p>
        <p className="mt-1 text-sm text-gray-500">
          {profile?.city || 'Ciudad no definida'}{profile?.country ? `, ${profile.country}` : ''}
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Selecciona un álbum para buscar match de intercambio
        </label>
        <select
          value={selectedAlbumId}
          onChange={(event) => setSelectedAlbumId(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        >
          {albums.map((album) => (
            <option key={album.id} value={album.id}>
              {album.title}
            </option>
          ))}
        </select>
        {albums.length === 0 && (
          <p className="mt-2 text-sm text-gray-500">
            Activa al menos un álbum en tu dashboard para habilitar el matchmaking.
          </p>
        )}
      </div>

      {selectedAlbumId && profileId ? (
        <MatchViewer albumId={selectedAlbumId} profileId={profileId} />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          No hay un álbum seleccionado para calcular coincidencias.
        </div>
      )}
    </div>
  )
}