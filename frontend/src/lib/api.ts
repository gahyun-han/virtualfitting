import { getSupabaseClient } from './supabase'
import type { WardrobeItem, TryOnJob, ClothingCategory } from '@/types'

const BASE_URL = '/api/backend'

async function getAuthHeader(): Promise<Record<string, string>> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers = await getAuthHeader()

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers ?? {}),
    },
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const json = await res.json()
      detail = json.detail ?? detail
    } catch {
      // ignore parse errors
    }
    throw new Error(detail)
  }

  return res.json() as Promise<T>
}

// ── Wardrobe ──────────────────────────────────────────────────────────────────

export async function getWardrobe(
  category?: ClothingCategory
): Promise<WardrobeItem[]> {
  const query = category ? `?category=${category}` : ''
  return apiFetch<WardrobeItem[]>(`/api/v1/wardrobe${query}`)
}

export async function getWardrobeItem(id: string): Promise<WardrobeItem> {
  return apiFetch<WardrobeItem>(`/api/v1/wardrobe/${id}`)
}

export async function deleteWardrobeItem(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/wardrobe/${id}`, { method: 'DELETE' })
}

export async function updateWardrobeItem(
  id: string,
  data: Partial<Pick<WardrobeItem, 'name' | 'category' | 'subcategory'>>
): Promise<WardrobeItem> {
  return apiFetch<WardrobeItem>(`/api/v1/wardrobe/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// ── Try-On ────────────────────────────────────────────────────────────────────

export interface StartTryOnPayload {
  wardrobe_item_id: string
  person_image_base64: string
}

export async function startTryOn(
  payload: StartTryOnPayload
): Promise<TryOnJob> {
  return apiFetch<TryOnJob>('/api/v1/tryon/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getTryOnJob(id: string): Promise<TryOnJob> {
  return apiFetch<TryOnJob>(`/api/v1/tryon/${id}`)
}

export async function getTryOnHistory(): Promise<TryOnJob[]> {
  return apiFetch<TryOnJob[]>('/api/v1/tryon/history')
}

// ── Upload (multipart — no Content-Type override) ─────────────────────────────

export async function uploadClothingFile(
  file: File
): Promise<{ job_id: string; stream_url: string }> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) throw new Error('Not authenticated')

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${BASE_URL}/api/v1/upload/clothing`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const json = await res.json()
      detail = json.detail ?? detail
    } catch {
      // ignore
    }
    throw new Error(detail)
  }

  return res.json()
}

export async function getAuthToken(): Promise<string> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return session.access_token
}
