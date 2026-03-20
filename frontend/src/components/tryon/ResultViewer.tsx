'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ResultViewerProps {
  resultUrl: string
  className?: string
}

export default function ResultViewer({ resultUrl, className }: ResultViewerProps) {
  const [aspect, setAspect] = useState<number>(3 / 4)

  return (
    <div className={cn('w-full', className)}>
      <div
        className="relative w-full rounded-2xl overflow-hidden bg-zinc-900"
        style={{ aspectRatio: aspect }}
      >
        <Image
          src={resultUrl}
          alt="Try-on result"
          fill
          className="object-contain"
          priority
          onLoad={(e) => {
            const img = e.currentTarget
            if (img.naturalWidth && img.naturalHeight) {
              setAspect(img.naturalWidth / img.naturalHeight)
            }
          }}
        />
      </div>
    </div>
  )
}
