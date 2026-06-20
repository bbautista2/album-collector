import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useCollectorStore } from '../stores/collectorStore'

export function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { albums, userAlbums, fetchAlbums, fetchUserAlbums, activateAlbum, isLoading } =
    useCollectorStore()

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    fetchAlbums()
    fetchUserAlbums(user.id)
  }, [user, navigate, fetchAlbums, fetchUserAlbums])

  const userAlbumIds = userAlbums.map((ua) => ua.album_id)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mi Dashboard</h1>
        <p className="text-gray-600">Bienvenido, {user?.email}</p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Álbumes Disponibles</h2>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Cargando álbumes...</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {albums.map((album) => {
              const isActivated = userAlbumIds.includes(album.id)

              return (
                <div key={album.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="h-40 bg-gradient-to-r from-primary-400 to-primary-600 flex items-center justify-center">
                    {album.image_url ? (
                      <img
                        src={album.image_url}
                        alt={album.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-6xl">🎨</div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{album.title}</h3>
                    <p className="text-sm text-gray-600 mb-4">{album.description}</p>

                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs text-gray-500">
                        {album.total_stickers} figuras
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          isActivated
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {isActivated ? '✓ Activado' : 'No activado'}
                      </span>
                    </div>

                    {isActivated ? (
                      <button
                        onClick={() => navigate(`/album/${album.id}`)}
                        className="w-full bg-primary-600 text-white py-2 rounded-lg font-semibold hover:bg-primary-700 transition"
                      >
                        Ver Mi Colección
                      </button>
                    ) : (
                      <button
                        onClick={() => activateAlbum(user!.id, album.id)}
                        disabled={isLoading}
                        className="w-full bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-400 transition disabled:opacity-50"
                      >
                        Activar Álbum
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
