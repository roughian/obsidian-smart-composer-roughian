import {
  CLAUDE_ADAPTIVE_EFFORTS,
  ChatModel,
  GPT_5_6_EFFORTS,
  GPT_6_EFFORTS,
} from '../../../types/chat-model.types'

import {
  getQuickReasoningControl,
  updateQuickReasoningEffort,
} from './reasoning-effort'

const GPT_MODELS = [
  ['gpt-6-astra', 'medium', GPT_6_EFFORTS],
  ['gpt-5.6-sol', 'medium', GPT_5_6_EFFORTS],
  ['gpt-5.6-terra', 'low', GPT_5_6_EFFORTS],
  ['gpt-5.6-luna', 'none', GPT_5_6_EFFORTS],
] as const

function gptModel(
  model: (typeof GPT_MODELS)[number][0] = 'gpt-5.6-sol',
): Extract<ChatModel, { providerType: 'openai-plan' }> {
  return {
    id: `${model} (plan)`,
    model,
    providerId: 'openai-plan',
    providerType: 'openai-plan',
  }
}

function claudeModel(
  model = 'claude-sonnet-5',
): Extract<ChatModel, { providerType: 'anthropic-plan' }> {
  return {
    id: `${model} (plan)`,
    model,
    providerId: 'anthropic-plan',
    providerType: 'anthropic-plan',
  }
}

describe('quick reasoning effort', () => {
  it.each(GPT_MODELS)(
    'uses the default effort for %s when it is not configured',
    (model, expectedEffort) => {
      expect(getQuickReasoningControl(gptModel(model))?.value).toBe(
        expectedEffort,
      )
    },
  )

  it.each(
    GPT_MODELS.flatMap(([model, , efforts]) =>
      efforts.map((effort) => [model, effort] as const),
    ),
  )('shows every supported GPT effort for %s: %s', (model, effort) => {
    const configuredModel = {
      ...gptModel(model),
      reasoning: { reasoning_effort: effort },
    }

    expect(getQuickReasoningControl(configuredModel)?.value).toBe(effort)
  })

  it('hides none for GPT-6 and falls back to its default when none is saved', () => {
    const configuredModel = {
      ...gptModel('gpt-6-astra'),
      reasoning: { reasoning_effort: 'none' as const },
    }
    const control = getQuickReasoningControl(configuredModel)

    expect(control?.value).toBe('medium')
    expect(control?.options.some((option) => option.value === 'none')).toBe(
      false,
    )
    expect(() => updateQuickReasoningEffort(configuredModel, 'none')).toThrow(
      'Unsupported reasoning effort for gpt-6-astra: none',
    )
  })

  it.each(CLAUDE_ADAPTIVE_EFFORTS)(
    'shows every supported Claude effort: %s',
    (effort) => {
      const configuredModel: ReturnType<typeof claudeModel> = {
        ...claudeModel(),
        thinking: {
          enabled: true,
          mode: 'adaptive',
          effort,
          display: 'summarized',
        },
      }

      expect(getQuickReasoningControl(configuredModel)?.value).toBe(effort)
    },
  )

  it('shows off for disabled Claude thinking and supports versioned Sonnet 5 slugs', () => {
    const configuredModel: ReturnType<typeof claudeModel> = {
      ...claudeModel('claude-sonnet-5-20260715'),
      thinking: {
        enabled: false,
        mode: 'adaptive',
        effort: 'xhigh',
        display: 'omitted',
      },
    }

    expect(getQuickReasoningControl(configuredModel)?.value).toBe('off')
  })

  it.each(['claude-fable-5', 'claude-fable-5-1'])(
    'keeps %s adaptive thinking enabled in the quick control',
    (model) => {
      const configuredModel: ReturnType<typeof claudeModel> = {
        ...claudeModel(model),
        thinking: {
          enabled: false,
          mode: 'adaptive',
          effort: 'high',
          display: 'summarized',
        },
      }
      const control = getQuickReasoningControl(configuredModel)

      expect(control?.value).toBe('high')
      expect(control?.options.some((option) => option.value === 'off')).toBe(
        false,
      )
      expect(() => updateQuickReasoningEffort(configuredModel, 'off')).toThrow(
        'requires adaptive thinking',
      )
    },
  )

  it('requires Opus 5 adaptive thinking at xhigh and max', () => {
    const configuredModel: ReturnType<typeof claudeModel> = {
      ...claudeModel('claude-opus-5'),
      thinking: {
        enabled: true,
        mode: 'adaptive',
        effort: 'xhigh',
        display: 'summarized',
      },
    }
    const control = getQuickReasoningControl(configuredModel)

    expect(control?.options.some((option) => option.value === 'off')).toBe(
      false,
    )
    expect(() => updateQuickReasoningEffort(configuredModel, 'off')).toThrow(
      'requires adaptive thinking',
    )
  })

  it('hides the control for unsupported models and missing selections', () => {
    const unsupported: ChatModel = {
      id: 'gpt-5.5 (plan)',
      model: 'gpt-5.5',
      providerId: 'openai-plan',
      providerType: 'openai-plan',
    }

    expect(getQuickReasoningControl(unsupported)).toBeNull()
    expect(getQuickReasoningControl(undefined)).toBeNull()
  })

  it('sets GPT none immutably and removes its reasoning summary', () => {
    const original: ReturnType<typeof gptModel> = {
      ...gptModel(),
      reasoning: {
        reasoning_effort: 'high',
        reasoning_summary: 'detailed',
      },
    }

    const updated = updateQuickReasoningEffort(original, 'none')

    expect(updated).toEqual({
      ...original,
      reasoning: { reasoning_effort: 'none' },
    })
    expect(original.reasoning).toEqual({
      reasoning_effort: 'high',
      reasoning_summary: 'detailed',
    })
  })

  it('preserves the GPT reasoning summary for non-none efforts', () => {
    const original: ReturnType<typeof gptModel> = {
      ...gptModel(),
      reasoning: {
        reasoning_effort: 'medium',
        reasoning_summary: 'concise',
      },
    }

    expect(updateQuickReasoningEffort(original, 'max')).toMatchObject({
      reasoning: {
        reasoning_effort: 'max',
        reasoning_summary: 'concise',
      },
    })
  })

  it('turns Claude off without losing the saved effort or display setting', () => {
    const original: ReturnType<typeof claudeModel> = {
      ...claudeModel(),
      thinking: {
        enabled: true,
        mode: 'adaptive',
        effort: 'xhigh',
        display: 'omitted',
      },
    }

    const updated = updateQuickReasoningEffort(original, 'off')

    expect(updated).toMatchObject({
      thinking: {
        enabled: false,
        mode: 'adaptive',
        effort: 'xhigh',
        display: 'omitted',
      },
    })
    expect(original.thinking?.enabled).toBe(true)
  })

  it('enables Claude adaptive thinking and preserves its display setting', () => {
    const original: ReturnType<typeof claudeModel> = {
      ...claudeModel(),
      thinking: {
        enabled: false,
        mode: 'adaptive',
        effort: 'low',
        display: 'omitted',
      },
    }

    expect(updateQuickReasoningEffort(original, 'max')).toMatchObject({
      thinking: {
        enabled: true,
        mode: 'adaptive',
        effort: 'max',
        display: 'omitted',
      },
    })
  })

  it('rejects invalid and unsupported updates', () => {
    expect(() => updateQuickReasoningEffort(gptModel(), 'minimal')).toThrow(
      'Unsupported reasoning effort for gpt-5.6-sol: minimal',
    )
    expect(() => updateQuickReasoningEffort(claudeModel(), 'none')).toThrow(
      'Unsupported Claude reasoning effort: none',
    )
    expect(() =>
      updateQuickReasoningEffort(
        {
          id: 'gpt-5.5 (plan)',
          model: 'gpt-5.5',
          providerId: 'openai-plan',
          providerType: 'openai-plan',
        },
        'high',
      ),
    ).toThrow('Quick reasoning control is not supported for gpt-5.5')
  })
})
