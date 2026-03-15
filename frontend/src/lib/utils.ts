import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    top: 'Top',
    bottom: 'Bottom',
    dress: 'Dress',
    shoes: 'Shoes',
    outerwear: 'Outerwear',
    accessory: 'Accessory',
  }
  return map[category] ?? category
}

export function categoryColor(category: string): string {
  const map: Record<string, string> = {
    top: 'bg-blue-900 text-blue-200',
    bottom: 'bg-purple-900 text-purple-200',
    dress: 'bg-pink-900 text-pink-200',
    shoes: 'bg-amber-900 text-amber-200',
    outerwear: 'bg-green-900 text-green-200',
    accessory: 'bg-red-900 text-red-200',
  }
  return map[category] ?? 'bg-zinc-800 text-zinc-200'
}

export function dataURLtoFile(dataURL: string, filename: string): File {
  const [header, data] = dataURL.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bstr = atob(data)
  const u8arr = new Uint8Array(bstr.length)
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i)
  }
  return new File([u8arr], filename, { type: mime })
}
