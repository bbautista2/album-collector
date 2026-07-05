import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export function ResetPasswordRequestPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      const redirectTo = `${window.location.origin}/reset-password/confirm`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

      if (error) throw error

      setMessage('Si existe una cuenta con ese correo, recibirás un email para restablecer la contraseña.')
    } catch (err: any) {
      console.error('Reset password error:', err)
      setMessage(err.message || 'Error enviando el email de restauración')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Restablecer contraseña</h1>

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="tu@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-600 text-white py-2 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Enviando...' : 'Enviar email de recuperación'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-sm mt-6">
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
