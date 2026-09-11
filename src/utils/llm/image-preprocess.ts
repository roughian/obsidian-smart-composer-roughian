export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const
export const CONVERTED_IMAGE_MIME_TYPE = 'image/png'
export const MAX_IMAGE_SIDE_PX = 2048
const BYTES_PER_MEGABYTE = 1024 * 1024
export const MAX_IMAGE_FILE_BYTES = 20 * BYTES_PER_MEGABYTE

export type ImageDimensions = { width: number; height: number }

export type ImagePreprocessPlan =
  | { action: 'keep' }
  | { action: 'reencode'; width: number; height: number; mimeType: string }

const BASE64_BYTES_PER_CHAR = 3 / 4

/** Approximate decoded size of a base64 data URL payload. */
export function dataUrlByteSize(dataUrl: string): number {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.floor(payload.length * BASE64_BYTES_PER_CHAR) - padding
}

export function isSupportedImageMimeType(mimeType: string): boolean {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)
}

export function isImageFileTooLarge(byteSize: number): boolean {
  return byteSize > MAX_IMAGE_FILE_BYTES
}

export function fitWithinMaxSide(
  { width, height }: ImageDimensions,
  maxSide: number,
): ImageDimensions {
  const longest = Math.max(width, height)
  if (longest <= maxSide) return { width, height }
  const scale = maxSide / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function getImagePreprocessPlan({
  mimeType,
  byteSize,
  width,
  height,
}: ImageDimensions & {
  mimeType: string
  byteSize: number
}): ImagePreprocessPlan {
  const isSupported = isSupportedImageMimeType(mimeType)
  const fitted = fitWithinMaxSide({ width, height }, MAX_IMAGE_SIDE_PX)
  const needsResize = fitted.width !== width || fitted.height !== height
  // Clipboard screenshots arrive as barely compressed PNGs; canvas re-encoding shrinks them.
  const needsCompression = isImageFileTooLarge(byteSize)
  if (isSupported && !needsResize && !needsCompression) {
    return { action: 'keep' }
  }
  // Re-encoding drops GIF animation, so resized GIFs become PNG too.
  const keepsMime = isSupported && mimeType !== 'image/gif'
  return {
    action: 'reencode',
    ...fitted,
    mimeType: keepsMime ? mimeType : CONVERTED_IMAGE_MIME_TYPE,
  }
}
