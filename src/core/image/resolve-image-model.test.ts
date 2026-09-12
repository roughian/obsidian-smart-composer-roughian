import { ChatModel } from '../../types/chat-model.types'

import { resolveImageGenerationModel } from './resolve-image-model'

function planModel(
  model: string,
  overrides: Partial<ChatModel> = {},
): ChatModel {
  return {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: `${model} (plan)`,
    model,
    ...overrides,
  } as ChatModel
}

const CLAUDE_MODEL: ChatModel = {
  providerType: 'anthropic-plan',
  providerId: 'anthropic-plan',
  id: 'claude-sonnet-5 (plan)',
  model: 'claude-sonnet-5',
}

function settingsWith({
  chatModels,
  chatModelId,
  imageModelId,
}: {
  chatModels: ChatModel[]
  chatModelId: string
  imageModelId: string
}) {
  return {
    chatModels,
    chatModelId,
    imageGeneration: {
      modelId: imageModelId,
      outputFolder: 'Generated',
      quality: 'high' as const,
      concurrency: 1 as const,
      destination: 'vault' as const,
      eagleApiBaseUrl: 'http://localhost:41595',
    },
  }
}

describe('resolveImageGenerationModel', () => {
  it('uses the configured image model when it is enabled and capable', () => {
    const result = resolveImageGenerationModel(
      settingsWith({
        chatModels: [CLAUDE_MODEL, planModel('gpt-5.6-sol')],
        chatModelId: CLAUDE_MODEL.id,
        imageModelId: 'gpt-5.6-sol (plan)',
      }),
    )

    expect(result).toEqual({
      model: planModel('gpt-5.6-sol'),
      usedChatModelFallback: false,
    })
  })

  it('falls back to a capable chat model when the configured model is disabled', () => {
    const result = resolveImageGenerationModel(
      settingsWith({
        chatModels: [
          planModel('gpt-5.6-sol', { enable: false }),
          planModel('gpt-5.6-terra'),
        ],
        chatModelId: 'gpt-5.6-terra (plan)',
        imageModelId: 'gpt-5.6-sol (plan)',
      }),
    )

    expect(result).toEqual({
      model: planModel('gpt-5.6-terra'),
      usedChatModelFallback: true,
    })
  })

  it('returns null with a reason when neither model can generate images', () => {
    const result = resolveImageGenerationModel(
      settingsWith({
        chatModels: [CLAUDE_MODEL],
        chatModelId: CLAUDE_MODEL.id,
        imageModelId: 'gpt-5.6-sol (plan)',
      }),
    )

    expect(result.model).toBeNull()
    expect(result.usedChatModelFallback).toBe(false)
    expect(result.reason).toContain('gpt-5.6-sol (plan)')
  })

  it('does not accept a configured model without image generation support', () => {
    const result = resolveImageGenerationModel(
      settingsWith({
        chatModels: [CLAUDE_MODEL, planModel('gpt-5.6-luna')],
        chatModelId: 'gpt-5.6-luna (plan)',
        imageModelId: CLAUDE_MODEL.id,
      }),
    )

    expect(result).toEqual({
      model: planModel('gpt-5.6-luna'),
      usedChatModelFallback: true,
    })
  })
})
