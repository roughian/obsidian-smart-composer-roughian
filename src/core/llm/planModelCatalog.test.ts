import {
  PLAN_MODEL_CATALOG,
  mergePlanModelCatalog,
  migratePlanModelId,
} from './planModelCatalog'

describe('Plan model catalog', () => {
  it('adds every current Plan model and disables Gemini Plan', () => {
    const result = mergePlanModelCatalog([])

    expect(result.map((model) => model.id)).toEqual(
      PLAN_MODEL_CATALOG.map((model) => model.id),
    )
    expect(
      result
        .filter((model) => model.providerType === 'gemini-plan')
        .every((model) => model.enable === false),
    ).toBe(true)
  })

  it('includes the latest Claude and GPT Plan models', () => {
    expect(PLAN_MODEL_CATALOG).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'claude-fable-5.1 (plan)',
          model: 'claude-fable-5-1',
          thinking: expect.objectContaining({
            enabled: true,
            mode: 'adaptive',
          }),
        }),
        expect.objectContaining({
          id: 'gpt-6-astra (plan)',
          model: 'gpt-6-astra',
          reasoning: { reasoning_effort: 'medium' },
        }),
      ]),
    )
  })

  it('preserves user effort and enable choices for current models', () => {
    const result = mergePlanModelCatalog([
      {
        providerType: 'openai-plan',
        providerId: 'openai-plan',
        id: 'gpt-5.6-sol (plan)',
        model: 'gpt-5.6-sol',
        enable: false,
        reasoning: {
          reasoning_effort: 'xhigh',
          reasoning_summary: 'concise',
        },
      },
    ])

    expect(result).toContainEqual(
      expect.objectContaining({
        id: 'gpt-5.6-sol (plan)',
        enable: false,
        reasoning: {
          reasoning_effort: 'xhigh',
          reasoning_summary: 'concise',
        },
      }),
    )
  })

  it('keeps custom models, disables legacy Plan entries, and is idempotent', () => {
    const initial = [
      {
        providerType: 'openai-compatible',
        providerId: 'custom',
        id: 'custom-model',
        model: 'custom-model',
      },
      {
        providerType: 'openai-plan',
        providerId: 'openai-plan',
        id: 'gpt-5.5 (plan)',
        model: 'gpt-5.5',
      },
    ]
    const once = mergePlanModelCatalog(initial)

    expect(once).toContainEqual(initial[0])
    expect(once).toContainEqual({ ...initial[1], enable: false })
    expect(mergePlanModelCatalog(once)).toEqual(once)
  })

  it('migrates selected legacy IDs without changing unknown IDs', () => {
    expect(migratePlanModelId('gpt-5.5 (plan)')).toBe('gpt-5.6-sol (plan)')
    expect(migratePlanModelId('claude-opus-4.5 (plan)')).toBe(
      'claude-opus-4.8 (plan)',
    )
    expect(migratePlanModelId('custom-model')).toBe('custom-model')
  })
})
