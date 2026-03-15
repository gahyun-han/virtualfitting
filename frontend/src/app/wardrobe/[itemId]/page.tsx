'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, useParams } from 'next/navigation'
import { Trash2, Shirt, Edit2, Check, X, Loader2 } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import BottomNav from '@/components/layout/BottomNav'
import { getWardrobeItem } from '@/lib/api'
import { useMutateWardrobe } from '@/hooks/useWardrobe'
import { cn, categoryLabel, categoryColor, formatDate } from '@/lib/utils'
import type { WardrobeItem } from '@/types'

export default function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const router = useRouter()

  const [item, setItem] = useState<WardrobeItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [imgError, setImgError] = useState(false)

  const { deleteItem, updateItem } = useMutateWardrobe()

  useEffect(() => {
    if (!itemId) return
    getWardrobeItem(itemId)
      .then((data) => {
        setItem(data)
        setNameValue(data.name ?? '')
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [itemId])

  const handleDelete = async () => {
    if (!item) return
    if (!confirm('Delete this item?')) return
    try {
      await deleteItem(item.id)
      router.push('/wardrobe')
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveName = async () => {
    if (!item) return
    setSaving(true)
    try {
      const updated = await updateItem(item.id, { name: nameValue || null })
      setItem(updated)
      setEditingName(false)
    } catch (err) {
      console.error(err)
    }
    setSaving(false)
  }

  const imageUrl = item
    ? (item.segmented_url ?? item.original_url)
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <TopBar title="Item Detail" showBack />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
        </div>
        <BottomNav />
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <TopBar title="Item Detail" showBack />
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-red-400 text-sm text-center">
            {error ?? 'Item not found'}
          </p>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <TopBar
        title="Item Detail"
        showBack
        right={
          <button
            onClick={handleDelete}
            className="p-2 text-zinc-400 hover:text-red-400 transition-colors active:scale-90"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        }
      />

      <main className="flex-1 pb-24 overflow-y-auto">
        {/* Large image */}
        <div className="relative w-full aspect-[3/4] bg-zinc-900 mx-auto max-w-sm">
          {imageUrl && !imgError ? (
            <Image
              src={imageUrl}
              alt={item.name ?? item.category}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw"
              onError={() => setImgError(true)}
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-zinc-600 text-sm">No image available</span>
            </div>
          )}
        </div>

        <div className="px-4 pt-4 space-y-4">
          {/* Name editor */}
          <div className="flex items-center gap-2">
            {editingName ? (
              <>
                <input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  autoFocus
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-lg font-semibold focus:outline-none focus:border-zinc-500"
                  placeholder="Add a name..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') setEditingName(false)
                  }}
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  className="p-2 text-green-400 hover:text-green-300 active:scale-90"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="p-2 text-zinc-400 hover:text-white active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <h2 className="flex-1 text-xl font-bold text-white">
                  {item.name ?? (
                    <span className="text-zinc-500 font-normal italic">
                      Unnamed item
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setEditingName(true)}
                  className="p-2 text-zinc-500 hover:text-white active:scale-90"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Category badge */}
          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                'text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide',
                categoryColor(item.category)
              )}
            >
              {categoryLabel(item.category)}
            </span>

            {item.subcategory && (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 uppercase tracking-wide">
                {item.subcategory}
              </span>
            )}
          </div>

          {/* CLIP attributes */}
          {item.attributes && (
            <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Detected Attributes
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {item.attributes.color && (
                  <div>
                    <span className="text-zinc-500 text-xs">Color</span>
                    <p className="text-white font-medium capitalize">
                      {item.attributes.color}
                    </p>
                  </div>
                )}
                {item.attributes.style && (
                  <div>
                    <span className="text-zinc-500 text-xs">Style</span>
                    <p className="text-white font-medium capitalize">
                      {item.attributes.style}
                    </p>
                  </div>
                )}
                {item.attributes.pattern && (
                  <div>
                    <span className="text-zinc-500 text-xs">Pattern</span>
                    <p className="text-white font-medium capitalize">
                      {item.attributes.pattern}
                    </p>
                  </div>
                )}
                {item.clip_confidence != null && (
                  <div>
                    <span className="text-zinc-500 text-xs">Confidence</span>
                    <p className="text-white font-medium">
                      {Math.round(item.clip_confidence * 100)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Added date */}
          <p className="text-zinc-600 text-xs">
            Added {formatDate(item.created_at)}
          </p>
        </div>
      </main>

      {/* Try On CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black via-black to-transparent pt-8 pb-safe"
        style={{
          maxWidth: '28rem',
          margin: '0 auto',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="px-4">
          <a
            href={`/tryon?itemId=${item.id}`}
            className="flex items-center justify-center gap-2 w-full bg-white text-black font-semibold rounded-2xl py-4 active:scale-[0.98] transition-transform text-base"
          >
            <Shirt className="w-5 h-5" />
            Try On
          </a>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
