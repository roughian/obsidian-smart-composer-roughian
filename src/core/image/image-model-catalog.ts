import type { ChatModel } from '../../types/chat-model.types'

/**
 * Image-only models reachable with a provider API key (as opposed to the GPT
 * Plan models that generate through the subscription OAuth flow). Verified
 * against the vendor docs on 2026-09-12.
 */
export const API_IMAGE_MODEL_CATALOG: readonly ChatModel[] = [
  {
    providerType: 'gemini',
    providerId: 'gemini',
    id: 'gemini-3.1-flash-image',
    model: 'gemini-3.1-flash-image',
  },
  {
    providerType: 'gemini',
    providerId: 'gemini',
    id: 'gemini-3-pro-image',
    model: 'gemini-3-pro-image',
  },
  {
    providerType: 'xai',
    providerId: 'xai',
    id: 'grok-imagine-image-2.0',
    model: 'grok-imagine-image-2.0',
  },
]

const API_IMAGE_MODEL_NAMES: Readonly<
  Partial<Record<ChatModel['providerType'], readonly string[]>>
> = {
  gemini: [
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-lite-image',
    'gemini-3-pro-image',
    'gemini-2.5-flash-image',
  ],
  xai: ['grok-imagine-image-2.0'],
}

/** True for models that only produce images and are driven by an API key. */
export function isApiImageModel(
  model: Pick<ChatModel, 'providerType' | 'model'>,
): boolean {
  return (
    API_IMAGE_MODEL_NAMES[model.providerType]?.includes(model.model) ?? false
  )
}

type ModelRecord = { id?: string; enable?: boolean } & Record<string, unknown>

/** Appends catalog models missing from the user's list; keeps their enable flag. */
export function mergeImageModelCatalog(
  models: unknown,
): Record<string, unknown>[] {
  const existing = Array.isArray(models) ? (models as ModelRecord[]) : []
  const missing = API_IMAGE_MODEL_CATALOG.filter(
    (catalogModel) => !existing.some((model) => model.id === catalogModel.id),
  )
  return [...existing.map((model) => ({ ...model })), ...missing]
}
