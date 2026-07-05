import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

function parseSessionFromUrl() {
  try {
    const search = window.location.search
    const hash = window.location.hash
    const params = new URLSearchParams(search.replace(/^\?/, ''))

    // Some providers put tokens in the hash (e.g. #access_token=...)
    if (hash && hash.includes('=')) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
      for (const [k, v] of hashParams.entries()) params.set(k, v)
    }

    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    return access_token ? { access_token, refresh_token } : null
  } catch (err) {
    return null
  }
}

export function ResetPasswordConfirmPage() {
  const navigate = useNavigate()
  const [isInitializing, setIsInitializing] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      const session = parseSessionFromUrl()
      if (session?.access_token) {
        try {
          // set the session so supabase client is authenticated for updateUser
          const payload: any = { access_token: session.access_token }
          // supabase.auth.setSession types expect refresh_token, but sometimes the
          // recovery link only includes access_token; provide empty string when missing.
          payload.refresh_token = session.refresh_token ?? ''
          await supabase.auth.setSession(payload)
        } catch (err) {
          console.error('Error setting session from recovery link', err)
        }
      }

      setIsInitializing(false)
    }

    init()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (password.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirm) {
      setMessage('Las contraseñas no coinciden')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setMessage('Contraseña restablecida correctamente. Ahora puedes iniciar sesión.')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err: any) {
      console.error('Error setting new password:', err)
      setMessage(err.message || 'No se pudo restablecer la contraseña')
    } finally {
      setIsLoading(false)
    }
  }

  if (isInitializing) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Preparando restablecimiento de contraseña...</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Establecer nueva contraseña</h1>

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-600 text-white py-2 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Guardando...' : 'Establecer contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
