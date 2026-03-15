'use client'

import { PackageOpen } from 'lucide-react'
import ClothingCard from './ClothingCard'
import type { WardrobeItem } from '@/types'

interface WardrobeGridProps {
  items: WardrobeItem[]
  loading: boolean
  onDelete?: (id: string) => void
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-zinc-900">
      <div className="aspect-[3/4] skeleton" />
    </div>
  )
}

export default function WardrobeGrid({
  items,
  loading,
  onDelete,
}: WardrobeGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 px-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
        <PackageOpen className="w-16 h-16 text-zinc-700 mb-4" />
        <h3 className="text-zinc-300 font-semibold text-lg mb-2">
          No items yet
        </h3>
        <p className="text-zinc-500 text-sm">
          Tap the camera button below to add your first clothing item.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {items.map((item) => (
        <ClothingCard key={item.id} item={item} onDelete={onDelete} />
      ))}
    </div>
  )
}
