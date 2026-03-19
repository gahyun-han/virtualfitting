'use client'

import { useState, useRef, useCallback } from 'react'
import { startTryOn, getTryOnJob } from '@/lib/api'
import type { TryOnStatus } from '@/types'

const POLL_INTERVAL_MS = 3000

interface UseTryOnReturn {
  jobId: string | null
  status: TryOnStatus | null
  resultUrl: string | null
  loading: boolean
  error: string | null
  start: (wardrobeItemId: string, personImageBase64: string, bottomItemId?: string) => Promise<void>
  reset: () => void
}

export function useTryOn(): UseTryOnReturn {
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<TryOnStatus | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const pollJob = useCallback((id: string) => {
    stopPolling()

    pollRef.current = setInterval(async () => {
      try {
        const job = await getTryOnJob(id)
        setStatus(job.status)

        if (job.status === 'completed') {
          setResultUrl(job.result_url)
          setLoading(false)
          stopPolling()
        } else if (job.status === 'failed') {
          setError(job.error_message ?? 'Try-on processing failed')
          setLoading(false)
          stopPolling()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Polling error')
        setLoading(false)
        stopPolling()
      }
    }, POLL_INTERVAL_MS)
  }, [])

  const start = async (wardrobeItemId: string, personImageBase64: string, bottomItemId?: string) => {
    setLoading(true)
    setError(null)
    setResultUrl(null)
    setStatus('pending')

    try {
      const job = await startTryOn({
        wardrobe_item_id: wardrobeItemId,
        person_image_base64: personImageBase64,
        ...(bottomItemId ? { bottom_wardrobe_item_id: bottomItemId } : {}),
      })

      setJobId(job.id)
      setStatus(job.status)

      if (job.status === 'completed') {
        setResultUrl(job.result_url)
        setLoading(false)
      } else if (job.status === 'failed') {
        setError(job.error_message ?? 'Try-on failed immediately')
        setLoading(false)
      } else {
        pollJob(job.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start try-on')
      setLoading(false)
      setStatus('failed')
    }
  }

  const reset = () => {
    stopPolling()
    setJobId(null)
    setStatus(null)
    setResultUrl(null)
    setLoading(false)
    setError(null)
  }

  return { jobId, status, resultUrl, loading, error, start, reset }
}
