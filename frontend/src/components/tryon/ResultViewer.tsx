'use client'

import {
  ReactCompareSlider,
  ReactCompareSliderImage,
  ReactCompareSliderHandle,
} from 'react-compare-slider'
import { cn } from '@/lib/utils'

interface ResultViewerProps {
  beforeUrl: string
  afterUrl: string
  className?: string
}

export default function ResultViewer({
  beforeUrl,
  afterUrl,
  className,
}: ResultViewerProps) {
  return (
    <div className={cn('rounded-2xl overflow-hidden', className)}>
      <ReactCompareSlider
        itemOne={
          <ReactCompareSliderImage
            src={beforeUrl}
            alt="Before — original photo"
            style={{ objectFit: 'cover' }}
          />
        }
        itemTwo={
          <ReactCompareSliderImage
            src={afterUrl}
            alt="After — virtual try-on"
            style={{ objectFit: 'cover' }}
          />
        }
        handle={
          <ReactCompareSliderHandle
            buttonStyle={{
              backdropFilter: 'blur(4px)',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '2px solid white',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
              color: '#000',
              width: 44,
              height: 44,
            }}
            linesStyle={{
              background: 'rgba(255, 255, 255, 0.8)',
              width: 2,
            }}
          />
        }
        style={{ aspectRatio: '3/4', width: '100%' }}
      />

      {/* Labels */}
      <div className="flex justify-between px-4 py-2 text-xs text-zinc-500">
        <span>← Original</span>
        <span>Try-On →</span>
      </div>
    </div>
  )
}
