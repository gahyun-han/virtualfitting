'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import BottomNav from '@/components/layout/BottomNav'
import WardrobeGrid from '@/components/wardrobe/WardrobeGrid'
import CategoryFilter from '@/components/wardrobe/CategoryFilter'
import { useWardrobe, useMutateWardrobe } from '@/hooks/useWardrobe'
import type { ClothingCategory } from '@/types'

export default function WardrobePage() {
  const [selectedCategory, setSelectedCategory] = useState<
    ClothingCategory | 'all'
  >('all')

  const { items, loading, error } = useWardrobe(
    selectedCategory === 'all' ? undefined : selectedCategory
  )
  const { deleteItem } = useMutateWardrobe()

  const handleDelete = async (id: string) => {
    try {
      await deleteItem(id)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <TopBar title="My Wardrobe" />

      <CategoryFilter
        selected={selectedCategory}
        onChange={setSelectedCategory}
      />

      <main className="flex-1 pb-24">
        {error ? (
          <div className="px-4 py-8 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : (
          <WardrobeGrid
            items={items}
            loading={loading}
            onDelete={handleDelete}
          />
        )}
      </main>

      {/* FAB */}
      <Link
        href="/upload"
        className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg shadow-black/50 active:scale-90 transition-transform"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <Plus className="w-7 h-7 text-black" strokeWidth={2.5} />
      </Link>

      <BottomNav />
    </div>
  )
}
