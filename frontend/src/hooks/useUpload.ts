'use client'

import { useState, useCallback } from 'react'
import { uploadClothingFile, getAuthToken } from '@/lib/api'
import type { UploadProgress, WardrobeItem } from '@/types'

interface UseUploadReturn {
  progress: UploadProgress | null
  item: WardrobeItem | null
  loading: boolean
  error: string | null
  uploadClothing: (file: File) => Promise<void>
  reset: () => void
}

export function useUpload(): UseUploadReturn {
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [item, setItem] = useState<WardrobeItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadClothing = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    setItem(null)
    setProgress({
      stage: 'validating',
      progress: 0,
      message: 'Validating image...',
    })

    try {
      // Step 1: Upload the file and get a stream URL
      const { job_id } = await uploadClothingFile(file)

      // Step 2: Connect to SSE stream for progress updates
      const token = await getAuthToken()
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const streamUrl = `${backendUrl}/api/v1/upload/clothing/stream/${job_id}`

      await new Promise<void>((resolve, reject) => {
        // EventSource doesn't support custom headers natively,
        // so we pass token as a query param (backend must accept this)
        const url = `${streamUrl}?token=${encodeURIComponent(token)}`
        const es = new EventSource(url)

        es.onmessage = (event) => {
          try {
            const data: UploadProgress = JSON.parse(event.data)
            setProgress(data)

            if (data.stage === 'done') {
              if (data.item) {
                setItem(data.item)
              }
              setLoading(false)
              es.close()
              resolve()
            } else if (data.stage === 'error') {
              const errMsg = data.error ?? 'Upload processing failed'
              setError(errMsg)
              setLoading(false)
              es.close()
              reject(new Error(errMsg))
            }
          } catch {
            // Ignore parse errors for non-JSON events
          }
        }

        es.onerror = () => {
          const errMsg = 'Connection to upload stream lost'
          setError(errMsg)
          setLoading(false)
          es.close()
          reject(new Error(errMsg))
        }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      setProgress({
        stage: 'error',
        progress: 0,
        message,
        error: message,
      })
      setLoading(false)
    }
  }, [])

  const reset = () => {
    setProgress(null)
    setItem(null)
    setLoading(false)
    setError(null)
  }

  return { progress, item, loading, error, uploadClothing, reset }
}
