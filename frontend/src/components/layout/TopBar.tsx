'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title: string
  showBack?: boolean
  backHref?: string
  className?: string
  right?: React.ReactNode
}

export default function TopBar({
  title,
  showBack = false,
  backHref,
  className,
  right,
}: TopBarProps) {
  const router = useRouter()

  const handleBack = () => {
    if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 bg-black/90 backdrop-blur-sm border-b border-zinc-900',
        className
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center h-14 px-4 gap-3">
        {showBack && (
          <button
            onClick={handleBack}
            className="p-1 -ml-1 text-zinc-400 hover:text-white transition-colors active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <h1
          className={cn(
            'flex-1 text-lg font-semibold text-white truncate',
            showBack && 'text-base'
          )}
        >
          {title}
        </h1>

        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </header>
  )
}
