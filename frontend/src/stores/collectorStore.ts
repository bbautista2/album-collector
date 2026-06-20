import { create } from 'zustand'
import type { Album, UserAlbum, UserSticker } from '../types'
import { supabase } from '../lib/supabase'

interface CollectorStore {
  albums: Album[]
  userAlbums: UserAlbum[]
  userStickers: UserSticker[]
  isLoading: boolean
  error: string | null

  fetchAlbums: () => Promise<void>
  fetchUserAlbums: (userId: string) => Promise<void>
  fetchUserStickers: (userId: string) => Promise<void>
  activateAlbum: (userId: string, albumId: string) => Promise<void>
  deactivateAlbum: (userId: string, albumId: string) => Promise<void>
  updateStickerQuantity: (
    userId: string,
    stickerId: string,
    quantityOwned: number,
    quantityRepeated: number
  ) => Promise<void>
}

export const useCollectorStore = create<CollectorStore>((set) => ({
  albums: [],
  userAlbums: [],
  userStickers: [],
  isLoading: false,
  error: null,

  fetchAlbums: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.from('albums').select('*')
      if (error) throw error
      set({ albums: data || [] })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch albums'
      set({ error: errorMessage })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchUserAlbums: async (userId) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('user_albums')
        .select('*')
        .eq('user_id', userId)
      if (error) throw error
      set({ userAlbums: data || [] })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user albums'
      set({ error: errorMessage })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchUserStickers: async (userId) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('user_stickers')
        .select('*')
        .eq('user_id', userId)
      if (error) throw error
      set({ userStickers: data || [] })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user stickers'
      set({ error: errorMessage })
    } finally {
      set({ isLoading: false })
    }
  },

  activateAlbum: async (userId, albumId) => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase.from('user_albums').insert({
        user_id: userId,
        album_id: albumId,
      })
      if (error) throw error
      set((state) => ({
        userAlbums: [
          ...state.userAlbums,
          {
            id: '',
            user_id: userId,
            album_id: albumId,
            activated_at: new Date().toISOString(),
          },
        ],
      }))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to activate album'
      set({ error: errorMessage })
    } finally {
      set({ isLoading: false })
    }
  },

  deactivateAlbum: async (userId, albumId) => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase
        .from('user_albums')
        .delete()
        .eq('user_id', userId)
        .eq('album_id', albumId)
      if (error) throw error
      set((state) => ({
        userAlbums: state.userAlbums.filter(
          (ua) => !(ua.user_id === userId && ua.album_id === albumId)
        ),
      }))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deactivate album'
      set({ error: errorMessage })
    } finally {
      set({ isLoading: false })
    }
  },

  updateStickerQuantity: async (userId, stickerId, quantityOwned, quantityRepeated) => {
    set({ isLoading: true, error: null })
    try {
      // Check if sticker exists for user
      const { data: existingSticker } = await supabase
        .from('user_stickers')
        .select('id')
        .eq('user_id', userId)
        .eq('sticker_id', stickerId)
        .single()

      if (existingSticker) {
        // Update existing
        const { error } = await supabase
          .from('user_stickers')
          .update({
            quantity_owned: quantityOwned,
            quantity_repeated: quantityRepeated,
          })
          .eq('user_id', userId)
          .eq('sticker_id', stickerId)
        if (error) throw error
      } else {
        // Insert new
        const { error } = await supabase.from('user_stickers').insert({
          user_id: userId,
          sticker_id: stickerId,
          quantity_owned: quantityOwned,
          quantity_repeated: quantityRepeated,
        })
        if (error) throw error
      }

      // Refetch user stickers
      const { data, error } = await supabase
        .from('user_stickers')
        .select('*')
        .eq('user_id', userId)
      if (error) throw error
      set({ userStickers: data || [] })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update sticker'
      set({ error: errorMessage })
    } finally {
      set({ isLoading: false })
    }
  },
}))
