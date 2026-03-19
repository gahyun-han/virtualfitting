'use client'

import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Shirt, Loader2, AlertCircle, Plus, X } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import BottomNav from '@/components/layout/BottomNav'
import CameraCapture from '@/components/camera/CameraCapture'
import TryOnProgress from '@/components/tryon/TryOnProgress'
import { getWardrobeItem, getWardrobe } from '@/lib/api'
import { useTryOn } from '@/hooks/useTryOn'
import { categoryLabel, categoryColor, cn } from '@/lib/utils'
import type { WardrobeItem } from '@/types'

type Step = 'select-person' | 'preview' | 'processing' | 'done'

function itemImageUrl(item: WardrobeItem | null) {
  if (!item) return null
  return item.thumbnail_url ?? item.segmented_url ?? item.original_url ?? null
}

function TryOnPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const itemId = searchParams.get('itemId')

  const [wardrobeItem, setWardrobeItem] = useState<WardrobeItem | null>(null)
  const [itemLoading, setItemLoading] = useState(false)
  const [personImage, setPersonImage] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('select-person')

  // Bottom item state
  const [bottomItem, setBottomItem] = useState<WardrobeItem | null>(null)
  const [bottomCandidates, setBottomCandidates] = useState<WardrobeItem[]>([])
  const [showBottomPicker, setShowBottomPicker] = useState(false)
  const [bottomLoading, setBottomLoading] = useState(false)

  const { start, status, resultUrl, loading, error, jobId, reset } = useTryOn()

  // Load primary wardrobe item
  useEffect(() => {
    if (!itemId) return
    setItemLoading(true)
    getWardrobeItem(itemId)
      .then((item) => { setWardrobeItem(item); setItemLoading(false) })
      .catch(() => setItemLoading(false))
  }, [itemId])

  // Load bottom candidates when picker is opened
  const handleOpenBottomPicker = async () => {
    setShowBottomPicker(true)
    if (bottomCandidates.length > 0) return
    setBottomLoading(true)
    try {
      const items = await getWardrobe()
      setBottomCandidates(items.filter((i) => i.id !== itemId))
    } catch {
      // ignore
    } finally {
      setBottomLoading(false)
    }
  }

  // Advance to result page when done
  useEffect(() => {
    if (status === 'completed' && resultUrl && jobId) {
      if (personImage) sessionStorage.setItem('tryon_person_image', personImage)
      const topUrl = itemImageUrl(wardrobeItem!)
      if (topUrl) sessionStorage.setItem('tryon_clothing_image', topUrl)
      const botUrl = bottomItem ? itemImageUrl(bottomItem) : null
      if (botUrl) sessionStorage.setItem('tryon_bottom_clothing_image', botUrl)
      router.push(`/tryon/result?jobId=${jobId}&result=${encodeURIComponent(resultUrl)}`)
    }
  }, [status, resultUrl, jobId, personImage, wardrobeItem, bottomItem, router])

  const handlePersonCapture = (dataUrl: string) => {
    setPersonImage(dataUrl)
    setStep('preview')
  }

  const handleStartTryOn = async () => {
    if (!wardrobeItem || !personImage) return
    setStep('processing')
    const base64 = personImage.replace(/^data:image\/\w+;base64,/, '')
    await start(wardrobeItem.id, base64, bottomItem?.id)
  }

  const handleRetakePhoto = () => {
    setPersonImage(null)
    reset()
    setStep('select-person')
  }

  const clothingImageUrl = itemImageUrl(wardrobeItem)

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <TopBar title="Virtual Try-On" showBack />

      <main className="flex-1 pb-24 overflow-y-auto">
        {/* Primary item card */}
        {wardrobeItem && (
          <div className="mx-4 mt-4 bg-zinc-900 rounded-2xl p-3 flex items-center gap-3">
            {clothingImageUrl && (
              <div className="relative w-14 h-16 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
                <Image src={clothingImageUrl} alt={wardrobeItem.name ?? wardrobeItem.category} fill className="object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white font-medium text-sm truncate">{wardrobeItem.name ?? 'Unnamed item'}</p>
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide', categoryColor(wardrobeItem.category))}>
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

        {/* Bottom item row */}
        {wardrobeItem && step !== 'processing' && (
          <div className="mx-4 mt-2">
            {bottomItem ? (
              <div className="bg-zinc-900 rounded-2xl p-3 flex items-center gap-3">
                {itemImageUrl(bottomItem) && (
                  <div className="relative w-14 h-16 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
                    <Image src={itemImageUrl(bottomItem)!} alt={bottomItem.name ?? bottomItem.category} fill className="object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium text-sm truncate">{bottomItem.name ?? 'Unnamed item'}</p>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide', categoryColor(bottomItem.category))}>
                    {categoryLabel(bottomItem.category)}
                  </span>
                </div>
                <button onClick={() => setBottomItem(null)} className="p-1.5 text-zinc-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleOpenBottomPicker}
                className="w-full flex items-center justify-center gap-2 bg-zinc-900 border border-dashed border-zinc-700 text-zinc-400 rounded-2xl py-3 text-sm active:scale-[0.98] transition-transform"
              >
                <Plus className="w-4 h-4" />
                Add bottom (pants / skirt)
              </button>
            )}
          </div>
        )}

        {/* Bottom picker sheet */}
        {showBottomPicker && (
          <div className="fixed inset-0 z-50 bg-black/80 flex flex-col justify-end">
            <div className="bg-zinc-950 rounded-t-3xl p-4 max-h-[60vh] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-semibold">Select bottom</p>
                <button onClick={() => setShowBottomPicker(false)} className="p-1 text-zinc-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {bottomLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
                </div>
              ) : bottomCandidates.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">No items in wardrobe</p>
              ) : (
                <div className="overflow-y-auto grid grid-cols-3 gap-2 pb-4">
                  {bottomCandidates.map((item) => {
                    const img = itemImageUrl(item)
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setBottomItem(item); setShowBottomPicker(false) }}
                        className="flex flex-col gap-1 active:scale-[0.96] transition-transform"
                      >
                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800">
                          {img ? <Image src={img} alt={item.name ?? ''} fill className="object-cover" /> : null}
                        </div>
                        <p className="text-zinc-400 text-[10px] truncate text-center">{item.name ?? categoryLabel(item.category)}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* No item warning */}
        {!wardrobeItem && !itemLoading && step === 'select-person' && (
          <div className="mx-4 mt-4 bg-amber-950 border border-amber-800 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-200 font-medium">No item selected</p>
              <p className="text-amber-400/80 mt-1">
                Go to your wardrobe and tap &ldquo;Try On&rdquo; on a clothing item, or{' '}
                <a href="/wardrobe" className="underline">browse wardrobe</a>.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Capture */}
        {step === 'select-person' && (
          <div className="px-4 pt-4 space-y-3">
            <p className="text-zinc-400 text-sm text-center">Take a full-body photo or choose from gallery</p>
            <CameraCapture onCapture={handlePersonCapture} aspectRatio={3 / 4} className="w-full" />
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && personImage && (
          <div className="px-4 pt-4 space-y-4">
            <div className={cn('gap-3', bottomItem ? 'grid grid-cols-3' : 'grid grid-cols-2')}>
              {/* Person */}
              <div>
                <p className="text-zinc-500 text-xs text-center mb-2">Your photo</p>
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900">
                  <Image src={personImage} alt="Your photo" fill className="object-contain" />
                </div>
              </div>

              {/* Top */}
              {wardrobeItem && clothingImageUrl ? (
                <div>
                  <p className="text-zinc-500 text-xs text-center mb-2">Top</p>
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900">
                    <Image src={clothingImageUrl} alt={wardrobeItem.name ?? 'Top'} fill className="object-contain" />
                  </div>
                </div>
              ) : (
                <div className="aspect-[3/4] rounded-2xl bg-zinc-900 flex items-center justify-center">
                  <p className="text-zinc-600 text-xs">No item</p>
                </div>
              )}

              {/* Bottom (optional) */}
              {bottomItem && (
                <div>
                  <p className="text-zinc-500 text-xs text-center mb-2">Bottom</p>
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900">
                    {itemImageUrl(bottomItem) && (
                      <Image src={itemImageUrl(bottomItem)!} alt={bottomItem.name ?? 'Bottom'} fill className="object-contain" />
                    )}
                  </div>
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
                <button onClick={handleRetakePhoto} className="text-red-400 underline text-sm mt-2">Try again</button>
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
