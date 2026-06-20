import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function HomePage() {
  const { user } = useAuthStore()

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Collector
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Colecciona, intercambia y conecta con otros coleccionistas de figuritas del mundo.
        </p>

        {!user ? (
          <div className="flex gap-4 justify-center">
            <Link
              to="/signup"
              className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
            >
              Comenzar Ahora
            </Link>
            <Link
              to="/login"
              className="border-2 border-primary-600 text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition"
            >
              Iniciar Sesión
            </Link>
          </div>
        ) : (
          <Link
            to="/dashboard"
            className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
          >
            Ir al Dashboard
          </Link>
        )}
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-8 py-12">
        <div className="bg-white p-8 rounded-lg shadow-sm">
          <div className="text-3xl mb-4">🎨</div>
          <h3 className="text-xl font-semibold mb-2">Colecciona Figuras</h3>
          <p className="text-gray-600">
            Organiza tu colección de figuras por álbum y marca cuáles tienes y cuáles te faltan.
          </p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm">
          <div className="text-3xl mb-4">🤝</div>
          <h3 className="text-xl font-semibold mb-2">Crea Grupos Privados</h3>
          <p className="text-gray-600">
            Forma grupos con otros coleccionistas para intercambiar figuras repetidas.
          </p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm">
          <div className="text-3xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold mb-2">Busca Coleccionistas</h3>
          <p className="text-gray-600">
            Encuentra otros coleccionistas en tu ciudad que tengan las figuras que necesitas.
          </p>
        </div>
      </section>

      {/* Info */}
      <section className="bg-primary-50 p-8 rounded-lg">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">¿Cómo funciona?</h2>
        <div className="space-y-4 text-gray-700">
          <p>
            <strong>1. Regístrate:</strong> Crea tu cuenta con tu email y contraseña.
          </p>
          <p>
            <strong>2. Configura tu perfil:</strong> Agrega tu ciudad, país y elige si tu perfil es público o privado.
          </p>
          <p>
            <strong>3. Activa álbumes:</strong> Selecciona los álbumes que coleccionas.
          </p>
          <p>
            <strong>4. Registra tus figuras:</strong> Marca cuáles tienes y cuáles están repetidas para intercambio.
          </p>
          <p>
            <strong>5. Conecta:</strong> Crea grupos privados o busca otros coleccionistas en tu ciudad.
          </p>
        </div>
      </section>
    </div>
  )
}
