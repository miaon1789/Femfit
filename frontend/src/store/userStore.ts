import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

interface UserState {
  activeUserId: string | null
  profile: UserProfile | null
  loading: boolean
  setActiveUser: (userId: string | null) => void
  fetchProfile: (userId: string) => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  setProfile: (profile: UserProfile | null) => void
}

let requestVersion = 0

export const useUserStore = create<UserState>((set, get) => ({
  activeUserId: null,
  profile: null,
  loading: false,

  setActiveUser: (userId) => {
    if (get().activeUserId === userId) return
    requestVersion++
    set({ activeUserId: userId, profile: null, loading: false })
  },

  setProfile: (profile) => {
    if (!profile || profile.id === get().activeUserId) set({ profile })
  },

  fetchProfile: async (userId: string) => {
    if (get().activeUserId !== userId) return
    const version = ++requestVersion
    set({ loading: true })
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    if (version !== requestVersion || get().activeUserId !== userId) return
    if (error && error.code !== 'PGRST116') {
      console.error('fetchProfile error:', error)
    }
    set({ profile: data ?? null, loading: false })
  },

  updateProfile: async (updates) => {
    const { profile } = get()
    if (!profile || profile.id !== get().activeUserId) throw new Error('unauthorized')
    const version = requestVersion
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', profile.id)
      .select()
      .single()
    if (error) throw error
    if (version === requestVersion && get().activeUserId === profile.id) set({ profile: data })
  }
}))
