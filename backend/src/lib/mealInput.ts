import { z } from 'zod'

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const MAX_MEAL_REQUEST_BYTES = 3 * 1024 * 1024
const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4

const ImageSchema = z.object({
  media_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  data: z.string().min(1).max(MAX_BASE64_LENGTH, 'image_too_large'),
}).superRefine((image, ctx) => {
  if (image.data.length > MAX_BASE64_LENGTH) return
  const invalid = () => ctx.addIssue({ code: 'custom', path: ['data'], message: 'invalid_image' })
  if (image.data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data)) return invalid()
  const bytes = Buffer.from(image.data, 'base64')
  if (bytes.length > MAX_IMAGE_BYTES) {
    ctx.addIssue({ code: 'custom', path: ['data'], message: 'image_too_large' })
    return
  }
  if (bytes.toString('base64') !== image.data) return invalid()
  const matches = image.media_type === 'image/jpeg'
    ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    : image.media_type === 'image/png'
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!matches) invalid()
})

export const MealInputSchema = z.object({
  description: z.string().trim().max(500).default(''),
  image: ImageSchema.optional(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  locale: z.enum(['en', 'zh']).optional(),
}).refine(input => input.description.length > 0 || !!input.image, {
  path: ['description'], message: 'meal_input_required',
})

export type MealImage = z.infer<typeof ImageSchema>

export class MealInputError extends Error {
  constructor(readonly code: 'ai_invalid_input' | 'ai_meal_input_required' | 'ai_invalid_image' | 'ai_image_too_large',
    readonly status: 400 | 413 = 400) { super(code) }
}

/** Bound actual streamed bytes, including requests without Content-Length. */
export async function readMealInput(request: Request): Promise<z.infer<typeof MealInputSchema>> {
  if (Number(request.headers.get('content-length')) > MAX_MEAL_REQUEST_BYTES) {
    throw new MealInputError('ai_image_too_large', 413)
  }
  const reader = request.body?.getReader()
  if (!reader) throw new MealInputError('ai_meal_input_required')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_MEAL_REQUEST_BYTES) {
        void reader.cancel().catch(() => {})
        throw new MealInputError('ai_image_too_large', 413)
      }
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof MealInputError) throw error
    throw new MealInputError('ai_invalid_input')
  } finally { reader.releaseLock() }
  let input: unknown
  try { input = JSON.parse(Buffer.concat(chunks, length).toString('utf8')) }
  catch { throw new MealInputError('ai_invalid_input') }
  const result = MealInputSchema.safeParse(input)
  if (result.success) return result.data
  if (result.error.issues.some(issue => issue.message === 'image_too_large')) throw new MealInputError('ai_image_too_large', 413)
  if (result.error.issues.some(issue => issue.path[0] === 'image')) throw new MealInputError('ai_invalid_image')
  if (result.error.issues.some(issue => issue.message === 'meal_input_required')) throw new MealInputError('ai_meal_input_required')
  throw new MealInputError('ai_invalid_input')
}
