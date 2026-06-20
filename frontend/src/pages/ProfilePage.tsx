import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export function ProfilePage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    city: '',
    country: '',
    is_public: false,
  })

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    const fetchProfile = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()

        if (error) throw error

        if (data) {
          setProfile(data)
          setFormData({
            username: data.username,
            full_name: data.full_name || '',
            city: data.city || '',
            country: data.country || '',
            is_public: data.is_public,
          })
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [user, navigate])

  const handleSave = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          city: formData.city,
          country: formData.country,
          is_public: formData.is_public,
        })
        .eq('id', user.id)

      if (error) throw error

      setProfile({ ...profile!, ...formData })
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cargando perfil...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>

      {profile && (
        <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
          {!isEditing ? (
            <>
              <div>
                <label className="text-sm text-gray-600">Usuario</label>
                <p className="text-lg font-semibold text-gray-900">{profile.username}</p>
              </div>

              <div>
                <label className="text-sm text-gray-600">Nombre Completo</label>
                <p className="text-lg font-semibold text-gray-900">{profile.full_name || '-'}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Ciudad</label>
                  <p className="text-lg font-semibold text-gray-900">{profile.city || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">País</label>
                  <p className="text-lg font-semibold text-gray-900">{profile.country || '-'}</p>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">Privacidad</label>
                <p className="text-lg font-semibold text-gray-900">
                  {profile.is_public ? (
                    <span className="text-green-600">✓ Público</span>
                  ) : (
                    <span className="text-red-600">🔒 Privado</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {profile.is_public
                    ? 'Otros usuarios pueden ver tu perfil y figuras'
                    : 'Tu perfil solo es visible para ti'}
                </p>
              </div>

              <button
                onClick={() => setIsEditing(true)}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-700 transition"
              >
                Editar Perfil
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_public}
                    onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Hacer perfil público</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Si está activado, otros usuarios pueden ver tu perfil y figuras
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 transition"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
