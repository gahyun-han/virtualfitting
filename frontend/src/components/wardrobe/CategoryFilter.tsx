'use client'

import { cn } from '@/lib/utils'
import type { ClothingCategory } from '@/types'

const CATEGORIES: Array<{ value: ClothingCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'top', label: 'Tops' },
  { value: 'bottom', label: 'Bottoms' },
  { value: 'dress', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessory', label: 'Accessories' },
]

interface CategoryFilterProps {
  selected: ClothingCategory | 'all'
  onChange: (cat: ClothingCategory | 'all') => void
}

export default function CategoryFilter({
  selected,
  onChange,
}: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
      {CATEGORIES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            'filter-pill whitespace-nowrap',
            selected === value ? 'filter-pill-active' : 'filter-pill-inactive'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
