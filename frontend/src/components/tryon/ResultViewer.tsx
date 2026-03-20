'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ResultViewerProps {
  personUrl: string
  clothingUrls: string[]
  resultUrl: string
  className?: string
}

export default function ResultViewer({
  personUrl,
  clothingUrls,
  resultUrl,
  className,
}: ResultViewerProps) {
  const [personAspect, setPersonAspect] = useState<number>(3 / 4)

  return (
    <div className={cn('grid grid-cols-3 gap-2 items-start', className)}>
      {/* Body */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-500 text-center">Body</span>
        <div className="relative w-full rounded-xl overflow-hidden bg-zinc-900" style={{ aspectRatio: personAspect }}>
          {personUrl ? (
            <Image
              src={personUrl}
              alt="Body"
              fill
              className="object-contain"
              onLoad={(e) => {
                const img = e.currentTarget
                if (img.naturalWidth && img.naturalHeight) {
                  setPersonAspect(img.naturalWidth / img.naturalHeight)
                }
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-zinc-600 text-xs">No photo</span>
            </div>
          )}
        </div>
      </div>

      {/* Outfit */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-500 text-center">Outfit</span>
        {clothingUrls.length === 0 && (
          <div className="relative w-full rounded-xl overflow-hidden bg-zinc-900" style={{ aspectRatio: personAspect }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-zinc-600 text-xs">No item</span>
            </div>
          </div>
        )}
        {clothingUrls.length === 1 && (
          <div className="relative w-full rounded-xl overflow-hidden bg-zinc-900" style={{ aspectRatio: personAspect }}>
            <Image src={clothingUrls[0]} alt="Outfit" fill className="object-contain" />
          </div>
        )}
        {clothingUrls.length >= 2 && (
          <div className="flex flex-col gap-1">
            <div className="relative w-full rounded-xl overflow-hidden bg-zinc-900" style={{ aspectRatio: '3/4' }}>
              <Image src={clothingUrls[0]} alt="Top" fill className="object-contain" />
            </div>
            <div className="relative w-full rounded-xl overflow-hidden bg-zinc-900" style={{ aspectRatio: '3/4' }}>
              <Image src={clothingUrls[1]} alt="Bottom" fill className="object-contain" />
            </div>
          </div>
        )}
      </div>

      {/* Result — same aspect ratio as person image */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-500 text-center">Result</span>
        <div className="relative w-full rounded-xl overflow-hidden bg-zinc-900" style={{ aspectRatio: personAspect }}>
          <Image src={resultUrl} alt="Try-on result" fill className="object-contain" />
        </div>
      </div>
    </div>
  )
}
