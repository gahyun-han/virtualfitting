'use client'

import useSWR, { useSWRConfig } from 'swr'
import {
  getWardrobe,
  deleteWardrobeItem,
  updateWardrobeItem,
} from '@/lib/api'
import type { ClothingCategory, WardrobeItem } from '@/types'

function wardrobeKey(category?: ClothingCategory) {
  return category ? `/wardrobe?category=${category}` : '/wardrobe'
}

export function useWardrobe(category?: ClothingCategory) {
  const { data, error, isLoading, mutate } = useSWR(
    wardrobeKey(category),
    () => getWardrobe(category),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  return {
    items: data ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    mutate,
  }
}

export function useMutateWardrobe() {
  const { mutate } = useSWRConfig()

  const revalidateAll = () => {
    // Revalidate all wardrobe keys (unfiltered + any category filter)
    mutate((key: unknown) => typeof key === 'string' && key.startsWith('/wardrobe'), undefined, {
      revalidate: true,
    })
  }

  const deleteItem = async (id: string) => {
    await deleteWardrobeItem(id)
    revalidateAll()
  }

  const updateItem = async (
    id: string,
    data: Partial<Pick<WardrobeItem, 'name' | 'category' | 'subcategory'>>
  ) => {
    const updated = await updateWardrobeItem(id, data)
    revalidateAll()
    return updated
  }

  return { deleteItem, updateItem }
}
