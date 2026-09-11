import { migrateFrom16To17 } from './16_to_17'

describe('Migration from v16 to v17', () => {
  it('should increment version to 17', () => {
    const oldSettings = {
      version: 16,
    }
    const result = migrateFrom16To17(oldSettings)
    expect(result.version).toBe(17)
  })

  it('should add the current Plan model catalog', () => {
    const oldSettings = {
      version: 16,
      providers: [],
      chatModels: [
        {
          id: 'custom-model',
          providerType: 'custom',
          providerId: 'custom',
          model: 'custom-model',
        },
      ],
    }

    const result = migrateFrom16To17(oldSettings)
    const chatModels = result.chatModels as {
      id: string
      providerType: string
      providerId: string
      model: string
      thinking?: { enabled?: boolean; mode?: string; effort?: string }
    }[]

    expect(
      chatModels.find((m) => m.id === 'claude-opus-4.8 (plan)'),
    ).toMatchObject({
      providerType: 'anthropic-plan',
      providerId: 'anthropic-plan',
      model: 'claude-opus-4-8',
    })
    expect(
      chatModels.find((m) => m.id === 'claude-fable-5 (plan)'),
    ).toMatchObject({
      providerType: 'anthropic-plan',
      providerId: 'anthropic-plan',
      model: 'claude-fable-5',
      thinking: { enabled: true, mode: 'adaptive', effort: 'high' },
    })
    expect(
      chatModels.find((m) => m.id === 'claude-opus-5 (plan)'),
    ).toMatchObject({
      providerType: 'anthropic-plan',
      providerId: 'anthropic-plan',
      model: 'claude-opus-5',
    })
    expect(
      chatModels.find((m) => m.id === 'claude-sonnet-5 (plan)'),
    ).toMatchObject({
      providerType: 'anthropic-plan',
      providerId: 'anthropic-plan',
      model: 'claude-sonnet-5',
    })
    expect(chatModels.find((m) => m.id === 'gpt-5.6-sol (plan)')).toMatchObject(
      {
        providerType: 'openai-plan',
        providerId: 'openai-plan',
        model: 'gpt-5.6-sol',
      },
    )
    expect(chatModels.find((m) => m.id === 'custom-model')).toBeDefined()
  })

  it('should remap selected legacy models to latest models', () => {
    const result = migrateFrom16To17({
      version: 16,
      chatModelId: 'claude-sonnet-4.5 (plan)',
      applyModelId: 'gpt-5.2',
    })

    expect(result.chatModelId).toBe('claude-sonnet-5 (plan)')
    expect(result.applyModelId).toBe('gpt-5.2')
  })

  it('should disable legacy Plan models without changing API models', () => {
    const result = migrateFrom16To17({
      version: 16,
      chatModels: [
        {
          providerType: 'anthropic-plan',
          providerId: 'anthropic-plan',
          id: 'claude-opus-4.5 (plan)',
          model: 'claude-opus-4-5',
        },
        {
          providerType: 'anthropic',
          providerId: 'anthropic',
          id: 'claude-sonnet-4.5',
          model: 'claude-sonnet-4-5',
        },
        {
          providerType: 'openai',
          providerId: 'openai',
          id: 'gpt-5.2',
          model: 'gpt-5.2',
        },
      ],
    })
    const chatModels = result.chatModels as {
      id: string
      enable?: boolean
    }[]

    expect(
      chatModels.find((m) => m.id === 'claude-opus-4.5 (plan)'),
    ).toMatchObject({
      enable: false,
    })
    expect(chatModels.find((m) => m.id === 'claude-sonnet-4.5')).toEqual({
      providerType: 'anthropic',
      providerId: 'anthropic',
      id: 'claude-sonnet-4.5',
      model: 'claude-sonnet-4-5',
    })
    expect(chatModels.find((m) => m.id === 'gpt-5.2')).toEqual({
      providerType: 'openai',
      providerId: 'openai',
      id: 'gpt-5.2',
      model: 'gpt-5.2',
    })
  })
})
