export type ClothingCategory =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'shoes'
  | 'outerwear'
  | 'accessory'

export interface ClipAttributes {
  color: string
  style: string
  pattern: string
  confidence: number
}

export interface WardrobeItem {
  id: string
  user_id: string
  name: string | null
  category: ClothingCategory
  subcategory: string | null
  attributes: ClipAttributes
  original_url: string
  segmented_url: string | null
  thumbnail_url: string | null
  clip_confidence: number | null
  created_at: string
}

export type TryOnStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface TryOnJob {
  id: string
  wardrobe_item_id: string | null
  person_image_url: string
  result_url: string | null
  status: TryOnStatus
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface UploadProgress {
  stage:
    | 'validating'
    | 'uploading'
    | 'segmenting'
    | 'classifying'
    | 'saving'
    | 'done'
    | 'error'
  progress: number
  message: string
  item?: WardrobeItem
  error?: string
}

export interface ApiError {
  detail: string
  status?: number
}
