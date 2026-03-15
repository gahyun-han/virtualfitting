'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RotateCcw, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import BottomNav from '@/components/layout/BottomNav'
import CameraCapture from '@/components/camera/CameraCapture'
import { useUpload } from '@/hooks/useUpload'
import { dataURLtoFile, categoryLabel, categoryColor, cn } from '@/lib/utils'
import type { UploadProgress } from '@/types'

type Step = 'capture' | 'preview' | 'processing' | 'result'

const STAGE_LABELS: Record<UploadProgress['stage'], string> = {
  validating: 'Validating image...',
  uploading: 'Uploading...',
  segmenting: 'Removing background...',
  classifying: 'Classifying garment...',
  saving: 'Saving to wardrobe...',
  done: 'Done!',
  error: 'Error',
}

export default function UploadPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('capture')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)

  const { progress, item, loading, error, uploadClothing, reset } = useUpload()

  const handleCapture = (dataUrl: string) => {
    setCapturedImage(dataUrl)
    setStep('preview')
  }

  const handleConfirm = async () => {
    if (!capturedImage) return
    setStep('processing')

    const file = dataURLtoFile(capturedImage, `clothing-${Date.now()}.jpg`)
    await uploadClothing(file)
    setStep('result')
  }

  const handleRetake = () => {
    setCapturedImage(null)
    reset()
    setStep('capture')
  }

  const handleAddAnother = () => {
    setCapturedImage(null)
    reset()
    setStep('capture')
  }

  const handleViewWardrobe = () => {
    router.push('/wardrobe')
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <TopBar
        title={
          step === 'capture'
            ? 'Add Clothing'
            : step === 'preview'
            ? 'Confirm Photo'
            : step === 'processing'
            ? 'Processing...'
            : 'Item Added!'
        }
        showBack={step === 'capture'}
      />

      <main className="flex-1 pb-24 overflow-y-auto">
        {/* Step 1: Camera */}
        {step === 'capture' && (
          <div className="px-4 pt-4 space-y-4">
            <p className="text-zinc-400 text-sm text-center">
              Take a photo of your clothing item or choose from your gallery
            </p>
            <CameraCapture
              onCapture={handleCapture}
              aspectRatio={3 / 4}
              className="w-full"
            />
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && capturedImage && (
          <div className="px-4 pt-4 space-y-4">
            <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900">
              <Image
                src={capturedImage}
                alt="Captured clothing"
                fill
                className="object-cover"
              />
            </div>

            <p className="text-zinc-400 text-sm text-center">
              Make sure the clothing item is clearly visible
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleRetake}
                className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 text-white rounded-2xl py-4 font-medium active:scale-[0.98] transition-transform border border-zinc-800"
              >
                <ChevronLeft className="w-5 h-5" />
                Retake
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-white text-black font-semibold rounded-2xl py-4 active:scale-[0.98] transition-transform"
              >
                Use Photo
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div className="px-4 pt-8 flex flex-col items-center gap-6">
            {/* Thumbnail preview */}
            {capturedImage && (
              <div className="relative w-32 h-40 rounded-2xl overflow-hidden bg-zinc-900">
                <Image
                  src={capturedImage}
                  alt="Processing"
                  fill
                  className="object-cover opacity-60"
                />
              </div>
            )}

            {/* Progress */}
            {progress && (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white font-medium">
                    {STAGE_LABELS[progress.stage]}
                  </span>
                  <span className="text-zinc-400">
                    {Math.round(progress.progress)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-300 relative overflow-hidden shimmer"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>

                <p className="text-zinc-500 text-xs text-center">
                  {progress.message}
                </p>
              </div>
            )}

            {!progress && loading && (
              <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
            )}
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && (
          <div className="px-4 pt-6 flex flex-col items-center gap-5">
            {error ? (
              <>
                <XCircle className="w-16 h-16 text-red-400" />
                <div className="text-center">
                  <h3 className="text-white font-semibold text-lg">
                    Upload failed
                  </h3>
                  <p className="text-zinc-400 text-sm mt-1">{error}</p>
                </div>
                <button
                  onClick={handleRetake}
                  className="flex items-center gap-2 bg-zinc-900 text-white rounded-2xl px-6 py-3 font-medium border border-zinc-800 active:scale-[0.98]"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try again
                </button>
              </>
            ) : item ? (
              <>
                <CheckCircle2 className="w-16 h-16 text-green-400" />

                <div className="text-center">
                  <h3 className="text-white font-semibold text-lg">
                    Item added!
                  </h3>
                  <p className="text-zinc-400 text-sm mt-1">
                    Your clothing has been added to your wardrobe
                  </p>
                </div>

                {/* Item preview card */}
                <div className="w-full bg-zinc-900 rounded-2xl overflow-hidden">
                  {item.thumbnail_url && (
                    <div className="relative w-full aspect-[3/4]">
                      <Image
                        src={item.thumbnail_url}
                        alt={item.name ?? item.category}
                        fill
                        className="object-contain"
                      />
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <span
                      className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide',
                        categoryColor(item.category)
                      )}
                    >
                      {categoryLabel(item.category)}
                    </span>

                    <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                      {item.attributes?.color && (
                        <div>
                          <p className="text-zinc-500">Color</p>
                          <p className="text-white capitalize">
                            {item.attributes.color}
                          </p>
                        </div>
                      )}
                      {item.attributes?.style && (
                        <div>
                          <p className="text-zinc-500">Style</p>
                          <p className="text-white capitalize">
                            {item.attributes.style}
                          </p>
                        </div>
                      )}
                      {item.attributes?.pattern && (
                        <div>
                          <p className="text-zinc-500">Pattern</p>
                          <p className="text-white capitalize">
                            {item.attributes.pattern}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={handleAddAnother}
                    className="flex-1 bg-zinc-900 text-white rounded-2xl py-4 font-medium border border-zinc-800 active:scale-[0.98] transition-transform"
                  >
                    Add Another
                  </button>
                  <button
                    onClick={handleViewWardrobe}
                    className="flex-1 bg-white text-black font-semibold rounded-2xl py-4 active:scale-[0.98] transition-transform"
                  >
                    View Wardrobe
                  </button>
                </div>
              </>
            ) : (
              <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
