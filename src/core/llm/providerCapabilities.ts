import { ChatModel } from '../../types/chat-model.types'
import { isApiImageModel } from '../image/image-model-catalog'

export type ProviderCapabilities = {
  plan: boolean
  tools: boolean
  reasoningEffort: boolean
  vision: boolean
  imageGeneration: boolean
  /** Image-only models: hidden from chat/apply model pickers. */
  imageOnly: boolean
  outputTokenLimit: boolean
}

// Policy table: gateways (ollama, lm-studio, openai-compatible) forward images
// and let users pick vision models themselves, so they stay permissive.
const VISION_PROVIDER_TYPES: ReadonlySet<ChatModel['providerType']> = new Set<
  ChatModel['providerType']
>([
  'anthropic',
  'anthropic-plan',
  'openai',
  'openai-plan',
  'azure-openai',
  'gemini',
  'gemini-plan',
  'openrouter',
  'xai',
  'ollama',
  'lm-studio',
  'openai-compatible',
])

const IMAGE_GENERATION_PLAN_MODELS: readonly string[] = [
  'gpt-6-astra',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
]

export function getProviderCapabilities(
  model: ChatModel,
): ProviderCapabilities {
  const plan = model.providerType.endsWith('-plan')
  const openAIPlan = model.providerType === 'openai-plan'
  const apiImageModel = isApiImageModel(model)

  return {
    plan,
    tools: model.providerType !== 'gemini-plan',
    reasoningEffort:
      model.providerType === 'openai-plan' ||
      model.providerType === 'openai' ||
      model.providerType === 'anthropic-plan' ||
      model.providerType === 'anthropic',
    vision: VISION_PROVIDER_TYPES.has(model.providerType),
    imageGeneration:
      (openAIPlan && IMAGE_GENERATION_PLAN_MODELS.includes(model.model)) ||
      apiImageModel,
    imageOnly: apiImageModel,
    // The private Codex endpoint currently rejects max_output_tokens.
    outputTokenLimit: !openAIPlan,
  }
}
