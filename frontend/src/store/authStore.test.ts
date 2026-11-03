import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import type { UserProfile } from '@/types'
import { useAuthStore } from './authStore'
import { useUserStore } from './userStore'

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(),
  updateUser: vi.fn(), resetPasswordForEmail: vi.fn(), from: vi.fn(), clearCache: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: mocks, from: mocks.from } }))
vi.mock('@/lib/privateCache', () => ({ clearPrivateApiCache: mocks.clearCache }))
const session = (id: string) => ({ user: { id }, access_token: `token-${id}` }) as Session
const profile = (id: string) => ({ id, nickname: id, onboarding_completed: true }) as UserProfile

beforeEach(() => {
  vi.resetAllMocks()
  mocks.clearCache.mockResolvedValue(undefined)
  useAuthStore.getState().setSession(null)
  useAuthStore.setState({ loading: false })
})

describe('account boundaries', () => {
  it('clears the profile on logout and loads the next account independently', async () => {
    useAuthStore.getState().setSession(session('a'))
    useUserStore.getState().setProfile(profile('a'))
    mocks.signOut.mockResolvedValue({ error: null })
    await useAuthStore.getState().signOut()
    expect(useUserStore.getState().profile).toBeNull()
    expect(useAuthStore.getState().session).toBeNull()
    expect(mocks.clearCache).toHaveBeenCalled()
    mocks.signInWithPassword.mockResolvedValue({ data: { session: session('b') }, error: null })
    await useAuthStore.getState().signIn('b@example.test', 'dummy-password')
    expect(useUserStore.getState().activeUserId).toBe('b')
    expect(useUserStore.getState().profile).toBeNull()
  })

  it('ignores a late profile response from a previous account', async () => {
    let resolve!: (value: unknown) => void
    const pending = new Promise(done => { resolve = done })
    const query = { select: vi.fn(), eq: vi.fn(), single: () => pending }
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
    mocks.from.mockReturnValue(query)
    useAuthStore.getState().setSession(session('a'))
    const request = useUserStore.getState().fetchProfile('a')
    useAuthStore.getState().setSession(session('b'))
    resolve({ data: profile('a'), error: null })
    await request
    expect(useUserStore.getState().profile).toBeNull()
    expect(useUserStore.getState().loading).toBe(false)
    useUserStore.getState().setProfile(profile('a'))
    expect(useUserStore.getState().profile).toBeNull()
  })

  it('keeps a valid profile on token refresh but clears it on an external sign-out event', () => {
    useAuthStore.getState().setSession(session('a'))
    useUserStore.getState().setProfile(profile('a'))
    useAuthStore.getState().setSession(session('a'))
    expect(useUserStore.getState().profile?.id).toBe('a')
    useAuthStore.getState().setSession(null)
    expect(useUserStore.getState().profile).toBeNull()
  })

  it('reports failed logout without pretending the session was removed', async () => {
    useAuthStore.getState().setSession(session('a'))
    mocks.signOut.mockResolvedValue({ error: new Error('offline') })
    await expect(useAuthStore.getState().signOut()).rejects.toThrow('auth.signOutFailed')
    expect(useAuthStore.getState().user?.id).toBe('a')
    expect(mocks.clearCache).toHaveBeenCalled()
  })
})

describe('password recovery', () => {
  it('preserves recovery on same-session focus events and token refresh, but clears it on a new login', async () => {
    useAuthStore.getState().setSession(session('a'), 'PASSWORD_RECOVERY')
    useAuthStore.getState().setSession(session('a'), 'SIGNED_IN')
    expect(useAuthStore.getState().recoveryUserId).toBe('a')
    const refreshed = { ...session('a'), access_token: 'refreshed-token' }
    useAuthStore.getState().setSession(refreshed, 'TOKEN_REFRESHED')
    useAuthStore.getState().setSession(refreshed, 'SIGNED_IN')
    expect(useAuthStore.getState().recoveryUserId).toBe('a')
    mocks.signInWithPassword.mockResolvedValue({ data: { session: refreshed }, error: null })
    await useAuthStore.getState().signIn('a@example.test', 'dummy-password')
    expect(useAuthStore.getState().recoveryUserId).toBeNull()
    useAuthStore.getState().setSession(refreshed, 'PASSWORD_RECOVERY')
    useAuthStore.getState().setSession({ ...refreshed, access_token: 'other-login-token' }, 'SIGNED_IN')
    expect(useAuthStore.getState().recoveryUserId).toBeNull()
  })

  it('requests a reset email with the actual change-password route', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://demo.example.test' } })
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null })
    try {
      await useAuthStore.getState().resetPassword('a@example.test')
      expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('a@example.test', {
        redirectTo: 'https://demo.example.test/reset-password',
      })
    } finally { vi.unstubAllGlobals() }
  })

  it('rejects weak, mismatched or unauthenticated password changes before contacting Supabase', async () => {
    await expect(useAuthStore.getState().updatePassword('short', 'short')).rejects.toThrow('auth.passwordMin8Error')
    await expect(useAuthStore.getState().updatePassword('long-password', 'different')).rejects.toThrow('auth.passwordMismatch')
    await expect(useAuthStore.getState().updatePassword('long-password', 'long-password')).rejects.toThrow('auth.resetLinkInvalid')
    useAuthStore.getState().setSession(session('ordinary-login'), 'SIGNED_IN')
    await expect(useAuthStore.getState().updatePassword('long-password', 'long-password')).rejects.toThrow('auth.resetLinkInvalid')
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('updates the password with a recovery session and reports rejected updates', async () => {
    useAuthStore.getState().setSession(session('recovery-user'), 'PASSWORD_RECOVERY')
    mocks.updateUser.mockResolvedValueOnce({ error: new Error('expired') }).mockResolvedValueOnce({ error: null })
    await expect(useAuthStore.getState().updatePassword('new-password', 'new-password')).rejects.toThrow('auth.resetFailed')
    await useAuthStore.getState().updatePassword('new-password', 'new-password')
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'new-password' })
    expect(useAuthStore.getState().recoveryUserId).toBeNull()
  })
})
