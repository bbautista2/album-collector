import { create } from 'zustand'
import type { AuthUser } from '../types'
import { supabase } from '../lib/supabase'

interface AuthStore {
  user: AuthUser | null
  isLoading: boolean
  error: string | null
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  signup: (email: string, password: string, username: string, fullName: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  signup: async (email, password, username, fullName) => {
    set({ isLoading: true, error: null })
    try {
      // Register user with Supabase Auth
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signupError) throw signupError

      if (data.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username,
            full_name: fullName,
            is_public: false,
          })

        if (profileError) throw profileError

        set({
          user: {
            id: data.user.id,
            email: data.user.email || email,
          },
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed'
      set({ error: errorMessage })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) throw loginError

      if (data.user) {
        set({
          user: {
            id: data.user.id,
            email: data.user.email || email,
          },
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed'
      set({ error: errorMessage })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      set({ user: null })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed'
      set({ error: errorMessage })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  checkAuth: async () => {
    set({ isLoading: true })
    try {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        set({
          user: {
            id: data.session.user.id,
            email: data.session.user.email || '',
          },
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Auth check failed'
      set({ error: errorMessage })
    } finally {
      set({ isLoading: false })
    }
  },
}))
