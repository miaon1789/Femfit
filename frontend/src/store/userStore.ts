import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

interface UserState {
  profile: UserProfile | null
  loading: boolean
  fetchProfile: (userId: string) => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  setProfile: (profile: UserProfile | null) => void
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  loading: false,

  setProfile: (profile) => set({ profile }),

  fetchProfile: async (userId: string) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    if (error && error.code !== 'PGRST116') {
      console.error('fetchProfile error:', error)
    }
    set({ profile: data ?? null, loading: false })
  },

  updateProfile: async (updates) => {
    const { profile } = get()
    if (!profile) return
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', profile.id)
      .select()
      .single()
    if (error) throw error
    set({ profile: data })
  }
}))
