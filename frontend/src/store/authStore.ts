import { create } from 'zustand'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useUserStore } from './userStore'
import { clearPrivateApiCache } from '@/lib/privateCache'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  recoveryUserId: string | null
  setSession: (session: Session | null, event?: AuthChangeEvent) => void
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string, confirm: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  user: null,
  loading: true,
  recoveryUserId: null,

  setSession: (session, event) => {
    const userId = session?.user.id ?? null
    const sameSession = get().user?.id === userId
      && (event !== 'SIGNED_IN' || get().session?.access_token === session?.access_token)
    const recoveryUserId = event === 'PASSWORD_RECOVERY' ? userId
      : !session || !sameSession ? null
      : get().recoveryUserId
    useUserStore.getState().setActiveUser(session?.user.id ?? null)
    set({ session, user: session?.user ?? null, loading: false, recoveryUserId })
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    set({ recoveryUserId: null })
    get().setSession(data.session, 'SIGNED_IN')
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    set({ recoveryUserId: null })
    get().setSession(data.session, 'SIGNED_IN')
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw new Error('auth.signOutFailed')
      get().setSession(null)
    } finally {
      await clearPrivateApiCache().catch(() => {})
    }
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
  },

  updatePassword: async (password, confirm) => {
    if (password.length < 8) throw new Error('auth.passwordMin8Error')
    if (password !== confirm) throw new Error('auth.passwordMismatch')
    if (!get().session || get().recoveryUserId !== get().session?.user.id) throw new Error('auth.resetLinkInvalid')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error('auth.resetFailed')
    set({ recoveryUserId: null })
  },
}))
