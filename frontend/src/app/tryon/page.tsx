'use client'

import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Shirt, Loader2, AlertCircle } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import BottomNav from '@/components/layout/BottomNav'
import CameraCapture from '@/components/camera/CameraCapture'
import TryOnProgress from '@/components/tryon/TryOnProgress'
import { getWardrobeItem } from '@/lib/api'
import { useTryOn } from '@/hooks/useTryOn'
import { categoryLabel, categoryColor, cn } from '@/lib/utils'
import type { WardrobeItem } from '@/types'

type Step = 'select-person' | 'preview' | 'processing' | 'done'

function TryOnPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const itemId = searchParams.get('itemId')

  const [wardrobeItem, setWardrobeItem] = useState<WardrobeItem | null>(null)
  const [itemLoading, setItemLoading] = useState(false)
  const [personImage, setPersonImage] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('select-person')

  const { start, status, resultUrl, loading, error, jobId, reset } = useTryOn()

  // Load wardrobe item if itemId is in URL
  useEffect(() => {
    if (!itemId) return
    setItemLoading(true)
    getWardrobeItem(itemId)
      .then((item) => {
        setWardrobeItem(item)
        setItemLoading(false)
      })
      .catch(() => setItemLoading(false))
  }, [itemId])

  // Advance to result page when done
  useEffect(() => {
    if (status === 'completed' && resultUrl && jobId) {
      router.push(
        `/tryon/result?jobId=${jobId}&result=${encodeURIComponent(resultUrl)}&person=${encodeURIComponent(personImage ?? '')}`
      )
    }
  }, [status, resultUrl, jobId, personImage, router])

  const handlePersonCapture = (dataUrl: string) => {
    setPersonImage(dataUrl)
    setStep('preview')
  }

  const handleStartTryOn = async () => {
    if (!wardrobeItem || !personImage) return
    setStep('processing')

    // Strip data URL prefix to get pure base64
    const base64 = personImage.replace(/^data:image\/\w+;base64,/, '')
    await start(wardrobeItem.id, base64)
  }

  const handleRetakePhoto = () => {
    setPersonImage(null)
    reset()
    setStep('select-person')
  }

  const clothingImageUrl =
    wardrobeItem?.thumbnail_url ??
    wardrobeItem?.segmented_url ??
    wardrobeItem?.original_url ??
    null

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <TopBar title="Virtual Try-On" showBack />

      <main className="flex-1 pb-24 overflow-y-auto">
        {/* Clothing item header card */}
        {wardrobeItem && (
          <div className="mx-4 mt-4 bg-zinc-900 rounded-2xl p-3 flex items-center gap-3">
            {clothingImageUrl && (
              <div className="relative w-14 h-16 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
                <Image
                  src={clothingImageUrl}
                  alt={wardrobeItem.name ?? wardrobeItem.category}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white font-medium text-sm truncate">
                {wardrobeItem.name ?? 'Unnamed item'}
              </p>
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide',
                  categoryColor(wardrobeItem.category)
                )}
              >
                {categoryLabel(wardrobeItem.category)}
              </span>
            </div>
          </div>
        )}

        {itemLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
          </div>
        )}

        {/* No item selected warning */}
        {!wardrobeItem && !itemLoading && step === 'select-person' && (
          <div className="mx-4 mt-4 bg-amber-950 border border-amber-800 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-200 font-medium">No item selected</p>
              <p className="text-amber-400/80 mt-1">
                Go to your wardrobe and tap &ldquo;Try On&rdquo; on a clothing item, or{' '}
                <a href="/wardrobe" className="underline">
                  browse wardrobe
                </a>
                .
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Capture person photo */}
        {step === 'select-person' && (
          <div className="px-4 pt-4 space-y-3">
            <p className="text-zinc-400 text-sm text-center">
              Take a full-body photo or choose from gallery
            </p>
            <CameraCapture
              onCapture={handlePersonCapture}
              aspectRatio={3 / 4}
              className="w-full"
            />
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && personImage && (
          <div className="px-4 pt-4 space-y-4">
            {/* Side by side: person + clothing */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-zinc-500 text-xs text-center mb-2">Your photo</p>
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900">
                  <Image
                    src={personImage}
                    alt="Your photo"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>

              {wardrobeItem && clothingImageUrl ? (
                <div>
                  <p className="text-zinc-500 text-xs text-center mb-2">Clothing</p>
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900">
                    <Image
                      src={clothingImageUrl}
                      alt={wardrobeItem.name ?? 'Clothing'}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              ) : (
                <div className="aspect-[3/4] rounded-2xl bg-zinc-900 flex items-center justify-center">
                  <p className="text-zinc-600 text-xs text-center px-2">
                    No item selected
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRetakePhoto}
                className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 text-white rounded-2xl py-4 font-medium border border-zinc-800 active:scale-[0.98] transition-transform"
              >
                <ChevronLeft className="w-5 h-5" />
                Retake
              </button>
              <button
                onClick={handleStartTryOn}
                disabled={!wardrobeItem}
                className="flex-1 flex items-center justify-center gap-2 bg-white text-black font-semibold rounded-2xl py-4 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                <Shirt className="w-5 h-5" />
                Try On
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div className="px-4 pt-4">
            <TryOnProgress status={status} />

            {error && (
              <div className="bg-red-950 border border-red-800 rounded-2xl p-4 mt-4 text-center">
                <p className="text-red-300 text-sm">{error}</p>
                <button
                  onClick={handleRetakePhoto}
                  className="text-red-400 underline text-sm mt-2"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

export default function TryOnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
        </div>
      }
    >
      <TryOnPageContent />
    </Suspense>
  )
}
