'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Share2, Download, RotateCcw, Loader2 } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import BottomNav from '@/components/layout/BottomNav'
import ResultViewer from '@/components/tryon/ResultViewer'

function ResultPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const resultUrl = searchParams.get('result') ?? ''
  const personUrl = searchParams.get('person') ?? ''

  const canShare =
    typeof navigator !== 'undefined' && !!navigator.share

  const handleShare = async () => {
    if (!canShare || !resultUrl) return
    try {
      // Fetch image as blob for sharing
      const res = await fetch(resultUrl)
      const blob = await res.blob()
      const file = new File([blob], 'virtual-tryon.jpg', { type: blob.type })

      await navigator.share({
        title: 'My Virtual Try-On',
        text: 'Check out how this outfit looks on me!',
        files: [file],
      })
    } catch {
      // User cancelled or API not supported
    }
  }

  const handleDownload = async () => {
    if (!resultUrl) return
    try {
      const res = await fetch(resultUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `virtual-tryon-${Date.now()}.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // fallback: open in new tab
      window.open(resultUrl, '_blank')
    }
  }

  const handleTryAnother = () => {
    router.push('/wardrobe')
  }

  if (!resultUrl) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <TopBar title="Try-On Result" showBack />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400 text-sm">No result to display.</p>
        </div>
        <BottomNav />
      </div>
    )
  }

  // Use person image from data URL or a placeholder
  const beforeUrl = personUrl || resultUrl

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <TopBar title="Try-On Result" showBack />

      <main className="flex-1 pb-24 overflow-y-auto">
        <div className="px-4 pt-4 space-y-4">
          <p className="text-zinc-400 text-sm text-center">
            Drag the handle to compare before & after
          </p>

          <ResultViewer
            beforeUrl={beforeUrl}
            afterUrl={resultUrl}
            className="w-full"
          />

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            {canShare && (
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 text-white rounded-2xl py-3.5 font-medium active:scale-[0.98] transition-transform"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            )}

            <button
              onClick={handleDownload}
              className={`flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 text-white rounded-2xl py-3.5 font-medium active:scale-[0.98] transition-transform ${
                canShare ? '' : 'col-span-2'
              }`}
            >
              <Download className="w-4 h-4" />
              Save Photo
            </button>
          </div>

          <button
            onClick={handleTryAnother}
            className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold rounded-2xl py-4 active:scale-[0.98] transition-transform"
          >
            <RotateCcw className="w-4 h-4" />
            Try Another Outfit
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

export default function TryOnResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
        </div>
      }
    >
      <ResultPageContent />
    </Suspense>
  )
}
