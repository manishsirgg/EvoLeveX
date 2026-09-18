'use client'

import { ChangeEvent, FormEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import { AVATAR_BUCKET, Avatar } from '../avatar'

const usernamePattern = /^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/
const allowedAvatarTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const maxAvatarBytes = 5 * 1024 * 1024

type Profile = {
  display_name: string | null
  username: string | null
  bio: string | null
  avatar_url: string | null
}
type FieldErrors = Partial<Record<'displayName' | 'username' | 'bio', string>>

function isOwnedAvatar(path: string | null, userId: string) {
  return Boolean(path && !/^https?:\/\//i.test(path) && path.startsWith(`avatars/${userId}/`))
}

export function ProfileForm({ initialProfile }: { initialProfile: Profile }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState(initialProfile.display_name ?? '')
  const [username, setUsername] = useState(initialProfile.username ?? '')
  const [bio, setBio] = useState(initialProfile.bio ?? '')
  const [avatarPath, setAvatarPath] = useState(initialProfile.avatar_url)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState('')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isHandlingAvatar, setIsHandlingAvatar] = useState(false)

  async function getAuthenticatedClient() {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    return { supabase, user: error ? null : user }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return

    const normalizedDisplayName = displayName.trim()
    const normalizedUsername = username.trim().toLowerCase()
    const normalizedBio = bio.trim()
    const nextErrors: FieldErrors = {}

    if (normalizedDisplayName.length > 80) nextErrors.displayName = 'Display name must be 80 characters or fewer.'
    if (username && !normalizedUsername) nextErrors.username = 'Remove the username or enter a valid one.'
    if (normalizedUsername && (normalizedUsername.length < 3 || normalizedUsername.length > 50)) nextErrors.username = 'Username must be between 3 and 50 characters.'
    else if (normalizedUsername && !usernamePattern.test(normalizedUsername)) nextErrors.username = 'Use lowercase letters, numbers, underscores, and single periods only.'
    if (normalizedBio.length > 400) nextErrors.bio = 'Bio must be 400 characters or fewer.'

    setErrors(nextErrors)
    setStatus('')
    setFormError('')
    if (Object.keys(nextErrors).length) return

    setIsSaving(true)
    try {
      const { supabase, user } = await getAuthenticatedClient()
      if (!user) {
        setFormError('Your session has expired. Sign in again to update your profile.')
        return
      }

      const { error } = await supabase.from('profiles').update({
        display_name: normalizedDisplayName || null,
        username: normalizedUsername || null,
        bio: normalizedBio || null,
      }).eq('id', user.id)

      if (error) {
        if (error.code === '23505' || error.message.toLowerCase().includes('unique')) {
          setErrors({ username: 'That username is already in use. Choose another.' })
        } else {
          setFormError('We could not save your profile right now. Please try again.')
        }
        return
      }

      setDisplayName(normalizedDisplayName)
      setUsername(normalizedUsername)
      setBio(normalizedBio)
      setStatus('Profile saved.')
      router.refresh()
    } catch {
      setFormError('We could not save your profile. Check your connection and try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || isHandlingAvatar) return

    setStatus('')
    setFormError('')
    const extension = allowedAvatarTypes[file.type]
    if (!extension) {
      setFormError('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > maxAvatarBytes) {
      setFormError('Avatar images must be 5 MB or smaller.')
      return
    }

    setIsHandlingAvatar(true)
    try {
      const { supabase, user } = await getAuthenticatedClient()
      if (!user) {
        setFormError('Your session has expired. Sign in again to update your avatar.')
        return
      }

      const newPath = `avatars/${user.id}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(newPath, file, { contentType: file.type, upsert: false })
      if (uploadError) {
        setFormError('We could not upload that image. Please try again.')
        return
      }

      const previousPath = avatarPath
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: newPath }).eq('id', user.id)
      if (updateError) {
        await supabase.storage.from(AVATAR_BUCKET).remove([newPath])
        setFormError('The image uploaded, but we could not update your profile. Please try again.')
        return
      }

      setAvatarPath(newPath)
      setStatus('Avatar updated.')
      router.refresh()

      if (isOwnedAvatar(previousPath, user.id)) {
        const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([previousPath!])
        if (cleanupError) setStatus('Avatar updated. The previous image could not be cleaned up automatically.')
      }
    } catch {
      setFormError('We could not update your avatar. Check your connection and try again.')
    } finally {
      setIsHandlingAvatar(false)
    }
  }

  async function handleAvatarRemove() {
    if (!avatarPath || isHandlingAvatar) return
    setIsHandlingAvatar(true)
    setStatus('')
    setFormError('')
    try {
      const { supabase, user } = await getAuthenticatedClient()
      if (!user) {
        setFormError('Your session has expired. Sign in again to remove your avatar.')
        return
      }

      const previousPath = avatarPath
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
      if (error) {
        setFormError('We could not remove your avatar right now. Please try again.')
        return
      }

      setAvatarPath(null)
      setStatus('Avatar removed.')
      router.refresh()
      if (isOwnedAvatar(previousPath, user.id)) {
        const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([previousPath!])
        if (cleanupError) setStatus('Avatar removed from your profile. The stored image could not be cleaned up automatically.')
      }
    } catch {
      setFormError('We could not remove your avatar. Check your connection and try again.')
    } finally {
      setIsHandlingAvatar(false)
    }
  }

  const avatarName = displayName.trim() || username.trim() || 'EvoLeveX member'

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-6">
      <section aria-labelledby="avatar-heading" className="border border-white/10 bg-zinc-900/50 p-6 sm:p-8">
        <h2 id="avatar-heading" className="text-lg font-semibold text-white">Profile image</h2>
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar path={avatarPath} name={avatarName} />
          <div>
            <p className="text-sm leading-6 text-zinc-400">JPEG, PNG, or WebP. Maximum 5 MB.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <input ref={fileInputRef} className="sr-only" id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} disabled={isHandlingAvatar} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isHandlingAvatar} className="border border-zinc-600 px-4 py-2.5 text-sm font-semibold text-white hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-50">{isHandlingAvatar ? 'Working…' : avatarPath ? 'Replace image' : 'Upload image'}</button>
              {avatarPath ? <button type="button" onClick={handleAvatarRemove} disabled={isHandlingAvatar} className="px-4 py-2.5 text-sm font-semibold text-zinc-400 hover:text-rose-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-50">Remove</button> : null}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="details-heading" className="border border-white/10 bg-zinc-900/50 p-6 sm:p-8">
        <h2 id="details-heading" className="text-lg font-semibold text-white">Profile details</h2>
        <div className="mt-6 grid gap-6">
          <div>
            <label htmlFor="display-name" className="text-sm font-medium text-zinc-200">Display name <span className="font-normal text-zinc-500">(optional)</span></label>
            <input id="display-name" autoComplete="name" maxLength={80} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setErrors((current) => ({ ...current, displayName: undefined })) }} aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? 'display-name-error' : undefined} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30" />
            {errors.displayName ? <p id="display-name-error" className="mt-2 text-sm text-rose-300">{errors.displayName}</p> : null}
          </div>
          <div>
            <label htmlFor="username" className="text-sm font-medium text-zinc-200">Username <span className="font-normal text-zinc-500">(optional)</span></label>
            <div className="mt-2 flex border border-zinc-700 bg-zinc-950 focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-300/30"><span aria-hidden="true" className="px-3 py-3 text-zinc-500">@</span><input id="username" autoComplete="username" minLength={3} maxLength={50} value={username} onChange={(event) => { setUsername(event.target.value.toLowerCase()); setErrors((current) => ({ ...current, username: undefined })) }} aria-invalid={Boolean(errors.username)} aria-describedby="username-help username-error" className="min-w-0 flex-1 bg-transparent py-3 pr-3 text-white outline-none" /></div>
            <p id="username-help" className="mt-2 text-sm text-zinc-500">3–50 lowercase letters, numbers, underscores, or periods.</p>
            {errors.username ? <p id="username-error" className="mt-2 text-sm text-rose-300">{errors.username}</p> : null}
          </div>
          <div>
            <div className="flex justify-between gap-4"><label htmlFor="bio" className="text-sm font-medium text-zinc-200">Bio <span className="font-normal text-zinc-500">(optional)</span></label><span className="text-xs text-zinc-500">{bio.length}/400</span></div>
            <textarea id="bio" rows={5} maxLength={400} value={bio} onChange={(event) => { setBio(event.target.value); setErrors((current) => ({ ...current, bio: undefined })) }} aria-invalid={Boolean(errors.bio)} aria-describedby={errors.bio ? 'bio-error' : undefined} className="mt-2 w-full resize-y border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30" />
            {errors.bio ? <p id="bio-error" className="mt-2 text-sm text-rose-300">{errors.bio}</p> : null}
          </div>
        </div>
      </section>

      <div aria-live="polite">{status ? <p role="status" className="border-l-2 border-emerald-400 pl-3 text-sm text-emerald-300">{status}</p> : null}{formError ? <p role="alert" className="border-l-2 border-rose-400 pl-3 text-sm text-rose-300">{formError}</p> : null}</div>
      <div className="flex justify-end"><button type="submit" disabled={isSaving || isHandlingAvatar} className="bg-white px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-50">{isSaving ? 'Saving…' : 'Save profile'}</button></div>
    </form>
  )
}
