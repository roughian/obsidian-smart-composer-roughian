import {
  DEFAULT_APPLY_MODEL_ID,
  DEFAULT_CHAT_MODELS,
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_EMBEDDING_MODELS,
  DEFAULT_PROVIDERS,
} from '../../constants'

import { SETTINGS_SCHEMA_VERSION } from './migrations'
import { parseSmartComposerSettings } from './settings'

describe('parseSmartComposerSettings', () => {
  it('should return default values for empty input', () => {
    const result = parseSmartComposerSettings({})
    expect(result).toEqual({
      version: SETTINGS_SCHEMA_VERSION,

      providers: [...DEFAULT_PROVIDERS],

      chatModels: [...DEFAULT_CHAT_MODELS],
      embeddingModels: [...DEFAULT_EMBEDDING_MODELS],

      chatModelId: DEFAULT_CHAT_MODEL_ID,
      applyModelId: DEFAULT_APPLY_MODEL_ID,
      embeddingModelId: 'openai/text-embedding-3-small',
      inlineEdit: {
        modelId: null,
        contextCharacters: 4000,
      },
      imageGeneration: {
        modelId: 'gpt-5.6-sol (plan)',
        outputFolder: 'Smart Composer/Generated Images',
        quality: 'high',
        concurrency: 1,
        destination: 'vault',
        eagleApiBaseUrl: 'http://localhost:41595',
      },
      systemPrompt: '',

      ragOptions: {
        retrievalMode: 'auto',
        folderReadMode: 'auto',
        chunkSize: 1000,
        thresholdTokens: 8192,
        exhaustiveDirectTokenLimit: 60000,
        minSimilarity: 0.0,
        limit: 10,
        planRerankCandidateLimit: 40,
        excludePatterns: [],
        includePatterns: [],
      },

      mcp: {
        servers: [],
      },

      chatOptions: {
        includeCurrentFileContent: true,
        enableTools: true,
        maxAutoIterations: 1,
      },
    })
  })

  it('upgrades v16 without losing OAuth, Apply, or custom models', () => {
    const input = {
      version: 16,
      providers: [
        {
          type: 'openai-plan',
          id: 'openai-plan',
          oauth: {
            accessToken: 'openai-access',
            refreshToken: 'openai-refresh',
            expiresAt: 1_900_000_000_000,
            accountId: 'account-id',
          },
        },
        {
          type: 'anthropic-plan',
          id: 'anthropic-plan',
          oauth: {
            accessToken: 'claude-access',
            refreshToken: 'claude-refresh',
            expiresAt: 1_900_000_000_000,
          },
        },
        {
          type: 'openai-compatible',
          id: 'custom-provider',
          baseUrl: 'https://example.invalid/v1',
          apiKey: 'custom-key',
        },
      ],
      chatModels: [
        {
          providerType: 'openai-plan',
          providerId: 'openai-plan',
          id: 'gpt-5.5 (plan)',
          model: 'gpt-5.5',
          reasoning: { reasoning_effort: 'minimal' },
        },
        {
          providerType: 'anthropic-plan',
          providerId: 'anthropic-plan',
          id: 'claude-sonnet-4.6 (plan)',
          model: 'claude-sonnet-4-6',
          thinking: { enabled: true, budget_tokens: 4096 },
        },
        {
          providerType: 'openai-compatible',
          providerId: 'custom-provider',
          id: 'custom-model',
          model: 'custom-model',
        },
      ],
      chatModelId: 'gpt-5.5 (plan)',
      applyModelId: 'claude-sonnet-4.6 (plan)',
    }
    const before = JSON.parse(JSON.stringify(input)) as typeof input

    const result = parseSmartComposerSettings(input)

    expect(input).toEqual(before)
    expect(result.version).toBe(17)
    expect(result.chatModelId).toBe('gpt-5.6-sol (plan)')
    expect(result.applyModelId).toBe('claude-sonnet-5 (plan)')
    expect(result.inlineEdit.modelId).toBeNull()
    expect(result.providers).toEqual(expect.arrayContaining(input.providers))
    expect(result.chatModels).toContainEqual(
      expect.objectContaining({
        providerType: 'openai-compatible',
        providerId: 'custom-provider',
        id: 'custom-model',
        model: 'custom-model',
      }),
    )
    expect(result.chatModels).toContainEqual(
      expect.objectContaining({ id: 'gpt-5.5 (plan)', enable: false }),
    )
    expect(result.chatModels).toContainEqual(
      expect.objectContaining({
        id: 'claude-sonnet-4.6 (plan)',
        enable: false,
      }),
    )
  })

  it('remaps legacy Plan selections in every feature without mutating input', () => {
    const input = {
      version: 17,
      chatModels: [...DEFAULT_CHAT_MODELS],
      chatModelId: 'gpt-5.5 (plan)',
      applyModelId: 'claude-opus-4.5 (plan)',
      inlineEdit: {
        modelId: 'claude-sonnet-4.6 (plan)',
        contextCharacters: 4000,
      },
      imageGeneration: {
        modelId: 'gpt-5.5 (plan)',
        outputFolder: 'Generated',
        quality: 'high',
        concurrency: 1,
        destination: 'vault',
        eagleApiBaseUrl: 'http://localhost:41595',
      },
    }
    const before = JSON.parse(JSON.stringify(input))

    const result = parseSmartComposerSettings(input)

    expect(input).toEqual(before)
    expect(result.chatModelId).toBe('gpt-5.6-sol (plan)')
    expect(result.applyModelId).toBe('claude-opus-4.8 (plan)')
    expect(result.inlineEdit.modelId).toBe('claude-sonnet-5 (plan)')
    expect(result.imageGeneration.modelId).toBe('gpt-5.6-sol (plan)')
  })

  it('defaults the image destination without discarding other image fields', () => {
    const result = parseSmartComposerSettings({
      version: SETTINGS_SCHEMA_VERSION,
      imageGeneration: {
        modelId: 'gpt-5.6-terra (plan)',
        outputFolder: 'Generated',
        quality: 'low',
        concurrency: 1,
      },
    })

    expect(result.imageGeneration).toEqual({
      modelId: 'gpt-5.6-terra (plan)',
      outputFolder: 'Generated',
      quality: 'low',
      concurrency: 1,
      destination: 'vault',
      eagleApiBaseUrl: 'http://localhost:41595',
    })
  })
})
