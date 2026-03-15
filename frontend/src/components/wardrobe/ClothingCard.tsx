'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { cn, categoryLabel, categoryColor } from '@/lib/utils'
import type { WardrobeItem } from '@/types'

interface ClothingCardProps {
  item: WardrobeItem
  onDelete?: (id: string) => void
}

const LONG_PRESS_MS = 500

export default function ClothingCard({ item, onDelete }: ClothingCardProps) {
  const [showDelete, setShowDelete] = useState(false)
  const [imgError, setImgError] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const imageUrl = item.thumbnail_url ?? item.segmented_url ?? item.original_url

  const handlePressStart = () => {
    pressTimer.current = setTimeout(() => {
      setShowDelete(true)
    }, LONG_PRESS_MS)
  }

  const handlePressEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete?.(item.id)
    setShowDelete(false)
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden bg-zinc-900 active:scale-[0.97] transition-transform"
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressEnd}
    >
      <Link href={`/wardrobe/${item.id}`} className="block">
        {/* Image container */}
        <div className="relative aspect-[3/4] bg-zinc-800 w-full overflow-hidden">
          {!imgError ? (
            <Image
              src={imageUrl}
              alt={item.name ?? item.category}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 33vw"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
              <span className="text-zinc-600 text-xs">No image</span>
            </div>
          )}

          {/* Category badge */}
          <div className="absolute top-2 left-2">
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide',
                categoryColor(item.category)
              )}
            >
              {categoryLabel(item.category)}
            </span>
          </div>

          {/* Delete overlay on long press */}
          {showDelete && (
            <div
              className="absolute inset-0 bg-black/60 flex items-center justify-center"
              onClick={(e) => {
                e.preventDefault()
                setShowDelete(false)
              }}
            >
              <button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white rounded-full p-4 flex items-center gap-2 font-medium active:scale-90 transition-transform"
              >
                <Trash2 className="w-5 h-5" />
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Name */}
        {item.name && (
          <div className="px-3 py-2">
            <p className="text-white text-sm font-medium truncate">{item.name}</p>
          </div>
        )}
      </Link>
    </div>
  )
}
