'use client'

import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TryOnStatus } from '@/types'

interface TryOnProgressProps {
  status: TryOnStatus | null
  className?: string
}

const STATUS_CONFIG: Record<
  NonNullable<TryOnStatus>,
  { label: string; description: string; color: string }
> = {
  pending: {
    label: 'Queued',
    description: 'Waiting for processing slot...',
    color: 'text-zinc-400',
  },
  processing: {
    label: 'Generating',
    description: 'AI is fitting the garment on your photo...',
    color: 'text-blue-400',
  },
  completed: {
    label: 'Done!',
    description: 'Your virtual try-on is ready.',
    color: 'text-green-400',
  },
  failed: {
    label: 'Failed',
    description: 'Something went wrong. Please try again.',
    color: 'text-red-400',
  },
}

export default function TryOnProgress({ status, className }: TryOnProgressProps) {
  if (!status) return null

  const config = STATUS_CONFIG[status]

  return (
    <div className={cn('flex flex-col items-center gap-4 py-8', className)}>
      {status === 'processing' || status === 'pending' ? (
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-zinc-800 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping" />
        </div>
      ) : status === 'completed' ? (
        <CheckCircle2 className="w-20 h-20 text-green-400" />
      ) : (
        <XCircle className="w-20 h-20 text-red-400" />
      )}

      <div className="text-center">
        <p className={cn('text-xl font-bold', config.color)}>{config.label}</p>
        <p className="text-zinc-400 text-sm mt-1 max-w-xs">{config.description}</p>
      </div>

      {/* Stage indicators */}
      {(status === 'processing' || status === 'pending') && (
        <div className="flex gap-2 mt-2">
          {['Analyzing', 'Fitting', 'Rendering'].map((stage, i) => (
            <div
              key={stage}
              className="flex items-center gap-1.5 text-xs text-zinc-500"
            >
              {i > 0 && <span className="text-zinc-700">›</span>}
              <span
                className={cn(
                  'transition-colors duration-500',
                  status === 'processing' && i === 1 && 'text-blue-400 font-medium'
                )}
              >
                {stage}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
