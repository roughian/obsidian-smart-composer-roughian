import {
  getInternalRagModel,
  shouldSurfacePlanRequestError,
} from './internalModel'

describe('getInternalRagModel', () => {
  it.each([
    ['gpt-6-astra', 'low'],
    ['gpt-5.6-sol', 'none'],
    ['gpt-5.6-terra', 'none'],
    ['gpt-5.6-luna', 'none'],
  ])('uses the lowest effort for %s', (model, effort) => {
    expect(
      getInternalRagModel({
        providerType: 'openai-plan',
        providerId: 'openai-plan',
        id: `${model} (plan)`,
        model,
        reasoning: {
          reasoning_effort: 'max',
          reasoning_summary: 'detailed',
        },
      }),
    ).toMatchObject({
      reasoning: { reasoning_effort: effort },
    })
  })

  it('disables Sonnet 5 adaptive thinking with a valid saved effort', () => {
    expect(
      getInternalRagModel({
        providerType: 'anthropic-plan',
        providerId: 'anthropic-plan',
        id: 'claude-sonnet-5 (plan)',
        model: 'claude-sonnet-5',
        thinking: {
          enabled: true,
          mode: 'adaptive',
          effort: 'xhigh',
          display: 'omitted',
        },
      }),
    ).toMatchObject({
      thinking: {
        enabled: false,
        mode: 'adaptive',
        effort: 'high',
        display: 'omitted',
      },
    })
  })

  it('keeps required Fable 5 thinking enabled at low effort', () => {
    expect(
      getInternalRagModel({
        providerType: 'anthropic-plan',
        providerId: 'anthropic-plan',
        id: 'claude-fable-5 (plan)',
        model: 'claude-fable-5',
        thinking: {
          enabled: true,
          mode: 'adaptive',
          effort: 'max',
          display: 'summarized',
        },
      }),
    ).toMatchObject({
      thinking: {
        enabled: true,
        mode: 'adaptive',
        effort: 'low',
      },
    })
  })

  it('keeps legacy behavior for manual thinking models', () => {
    expect(
      getInternalRagModel({
        providerType: 'anthropic',
        providerId: 'anthropic',
        id: 'legacy',
        model: 'legacy',
        thinking: { enabled: true, budget_tokens: 8192 },
      }),
    ).toMatchObject({ thinking: undefined })
  })
})

describe('shouldSurfacePlanRequestError', () => {
  it.each([400, 403, 404, 429])(
    'allows local fallback for HTTP %s',
    (status) => {
      expect(shouldSurfacePlanRequestError({ status })).toBe(false)
    },
  )

  it('surfaces only authentication failures', () => {
    expect(shouldSurfacePlanRequestError({ status: 401 })).toBe(true)
    expect(shouldSurfacePlanRequestError({ code: 'model_mismatch' })).toBe(
      false,
    )
    expect(shouldSurfacePlanRequestError(new Error('invalid JSON'))).toBe(false)
  })
})
