export interface MealPhotoInput {
  media_type: 'image/jpeg' | 'image/png' | 'image/webp'
  data: string
}

export const MAX_SOURCE_PHOTO_BYTES = 20 * 1024 * 1024
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export class MealPhotoError extends Error {}

export function photoDimensions(width: number, height: number) {
  const scale = Math.min(1, 1536 / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Re-encode locally to reduce upload size and omit the original EXIF metadata. */
export async function prepareMealPhoto(file: File): Promise<{ image: MealPhotoInput; preview: string }> {
  if (!SUPPORTED_TYPES.includes(file.type)) throw new MealPhotoError('food.photoUnsupported')
  if (!file.size || file.size > MAX_SOURCE_PHOTO_BYTES) throw new MealPhotoError('food.photoTooLarge')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new MealPhotoError('food.photoFailed'))
      image.src = url
    })
    if (!image.naturalWidth || !image.naturalHeight) throw new MealPhotoError('food.photoFailed')
    const canvas = document.createElement('canvas')
    const dimensions = photoDimensions(image.naturalWidth, image.naturalHeight)
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d')
    if (!context) throw new MealPhotoError('food.photoFailed')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new MealPhotoError('food.photoFailed')), 'image/jpeg', 0.82)
    })
    if (blob.size > MAX_UPLOAD_BYTES) throw new MealPhotoError('food.photoTooLarge')
    const preview = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new MealPhotoError('food.photoFailed'))
      reader.readAsDataURL(blob)
    })
    if (!preview.startsWith('data:image/jpeg;base64,')) throw new MealPhotoError('food.photoFailed')
    return { image: { media_type: 'image/jpeg', data: preview.split(',')[1] }, preview }
  } finally { URL.revokeObjectURL(url) }
}
