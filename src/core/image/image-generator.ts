import { ChatModel } from '../../types/chat-model.types'

export type GeneratedImage = {
  base64: string
  /** Declared by the provider when known; the adapter sniffs the bytes otherwise. */
  mimeType?: string
}

export type ImageGenerationOptions = {
  quality: 'low' | 'medium' | 'high'
  referenceImages: string[]
  signal?: AbortSignal
  onProgress?: (phase: string, partialImageIndex?: number) => void
}

/** Implemented by providers that can render an image from a prompt. */
export type ImageGenerator = {
  generateImage(
    model: ChatModel,
    prompt: string,
    options: ImageGenerationOptions,
  ): Promise<GeneratedImage>
}

export function isImageGenerator(client: unknown): client is ImageGenerator {
  return (
    !!client &&
    typeof client === 'object' &&
    typeof (client as { generateImage?: unknown }).generateImage === 'function'
  )
}
