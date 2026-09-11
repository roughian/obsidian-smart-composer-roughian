import { MentionableImage } from '../../types/mentionable'

import {
  ImagePreprocessPlan,
  MAX_IMAGE_FILE_BYTES,
  dataUrlByteSize,
  getImagePreprocessPlan,
  isImageFileTooLarge,
  isSupportedImageMimeType,
} from './image-preprocess'

const BYTES_PER_MEGABYTE = 1024 * 1024

export class ImageRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageRejectedError'
    Object.setPrototypeOf(this, ImageRejectedError.prototype)
  }
}

export type RejectedImage = { name: string; reason: string }

export function parseImageDataUrl(dataUrl: string): {
  mimeType: string
  base64Data: string
} {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)/)
  if (!matches) {
    throw new Error('Invalid image data URL format')
  }
  const [, mimeType, base64Data] = matches
  return { mimeType, base64Data }
}

export async function fileToMentionableImage(
  file: File,
): Promise<MentionableImage> {
  const dataUrl = await fileToBase64(file)
  const image = await decodeImage(dataUrl)
  if (!image) {
    // Clipboard blobs occasionally fail to decode; keep supported formats as-is.
    if (!isSupportedImageMimeType(file.type)) {
      throw new ImageRejectedError('File is not a readable image.')
    }
    return assertWithinSizeLimit({
      type: 'image',
      name: file.name,
      mimeType: file.type,
      data: dataUrl,
    })
  }
  const plan = getImagePreprocessPlan({
    mimeType: file.type,
    byteSize: file.size,
    width: image.naturalWidth,
    height: image.naturalHeight,
  })
  if (plan.action === 'keep') {
    return {
      type: 'image',
      name: file.name,
      mimeType: file.type,
      data: dataUrl,
    }
  }
  return assertWithinSizeLimit({
    type: 'image',
    name: file.name,
    mimeType: plan.mimeType,
    data: reencodeImage(image, plan),
  })
}

function assertWithinSizeLimit(image: MentionableImage): MentionableImage {
  if (isImageFileTooLarge(dataUrlByteSize(image.data))) {
    throw new ImageRejectedError(
      `Image is still over ${MAX_IMAGE_FILE_BYTES / BYTES_PER_MEGABYTE} MB after resizing.`,
    )
  }
  return image
}

/** Converts every file it can; rejected files are reported instead of thrown. */
export async function filesToMentionableImages(
  files: File[],
  convert: (file: File) => Promise<MentionableImage> = fileToMentionableImage,
): Promise<{ images: MentionableImage[]; rejected: RejectedImage[] }> {
  const images: MentionableImage[] = []
  const rejected: RejectedImage[] = []
  for (const file of files) {
    try {
      images.push(await convert(file))
    } catch (error) {
      rejected.push({
        name: file.name,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { images, rejected }
}

function decodeImage(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = dataUrl
  })
}

function reencodeImage(
  image: HTMLImageElement,
  plan: Extract<ImagePreprocessPlan, { action: 'reencode' }>,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = plan.width
  canvas.height = plan.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new ImageRejectedError('Canvas is unavailable for image conversion.')
  }
  context.drawImage(image, 0, 0, plan.width, plan.height)
  return canvas.toDataURL(plan.mimeType)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
  })
}
