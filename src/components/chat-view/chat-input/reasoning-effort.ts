import {
  canDisableClaude5Thinking,
  getClaude5PlanFamily,
} from '../../../core/llm/claudePlanModels'
import {
  getGptPlanDefaultEffort,
  getGptPlanEfforts,
} from '../../../core/llm/openaiPlanModels'
import {
  CLAUDE_ADAPTIVE_EFFORTS,
  ChatModel,
  ClaudeEffort,
  Gpt56Effort,
} from '../../../types/chat-model.types'

export type QuickReasoningEffort = Gpt56Effort | ClaudeEffort | 'off'

export type QuickReasoningOption = {
  value: QuickReasoningEffort
  label: string
  description: string
}

export type QuickReasoningControl = {
  kind: 'gpt' | 'claude'
  label: string
  value: QuickReasoningEffort
  options: readonly QuickReasoningOption[]
}

export const GPT_QUICK_REASONING_OPTIONS: readonly QuickReasoningOption[] = [
  { value: 'none', label: 'none', description: 'Fastest response' },
  { value: 'low', label: 'low', description: 'Light reasoning' },
  { value: 'medium', label: 'medium', description: 'Balanced reasoning' },
  { value: 'high', label: 'high', description: 'Deeper reasoning' },
  { value: 'xhigh', label: 'xhigh', description: 'Very deep reasoning' },
  { value: 'max', label: 'max', description: 'Deepest reasoning' },
]

export const CLAUDE_QUICK_REASONING_OPTIONS: readonly QuickReasoningOption[] = [
  { value: 'off', label: 'off', description: 'Adaptive thinking disabled' },
  { value: 'low', label: 'low', description: 'Light reasoning' },
  { value: 'medium', label: 'medium', description: 'Balanced reasoning' },
  { value: 'high', label: 'high', description: 'Deeper reasoning' },
  { value: 'xhigh', label: 'xhigh', description: 'Very deep reasoning' },
  { value: 'max', label: 'max', description: 'Deepest reasoning' },
]

function isGptPlanModel(
  model: ChatModel,
): model is Extract<ChatModel, { providerType: 'openai-plan' }> {
  return (
    model.providerType === 'openai-plan' &&
    getGptPlanEfforts(model.model) !== undefined
  )
}

function isClaude5PlanModel(
  model: ChatModel,
): model is Extract<ChatModel, { providerType: 'anthropic-plan' }> {
  return (
    model.providerType === 'anthropic-plan' &&
    getClaude5PlanFamily(model.model) !== null
  )
}

function isGptEffortFor(
  model: string,
  value: string | undefined,
): value is Gpt56Effort {
  return getGptPlanEfforts(model)?.includes(value as Gpt56Effort) ?? false
}

function isClaudeEffort(value: string): value is ClaudeEffort {
  return CLAUDE_ADAPTIVE_EFFORTS.includes(value as ClaudeEffort)
}

export function getQuickReasoningControl(
  model: ChatModel | undefined,
): QuickReasoningControl | null {
  if (!model) {
    return null
  }

  const gptDefaultEffort =
    model.providerType === 'openai-plan'
      ? getGptPlanDefaultEffort(model.model)
      : undefined
  if (model.providerType === 'openai-plan' && gptDefaultEffort) {
    const configuredEffort = model.reasoning?.reasoning_effort
    return {
      kind: 'gpt',
      label: 'GPT reasoning effort',
      value: isGptEffortFor(model.model, configuredEffort)
        ? configuredEffort
        : gptDefaultEffort,
      options: GPT_QUICK_REASONING_OPTIONS.filter((option) =>
        isGptEffortFor(model.model, option.value),
      ),
    }
  }

  if (isClaude5PlanModel(model)) {
    const adaptiveThinking =
      model.thinking?.mode === 'adaptive' ? model.thinking : undefined
    const effort = adaptiveThinking?.effort ?? 'high'
    const canDisable = canDisableClaude5Thinking(model.model, effort)
    return {
      kind: 'claude',
      label: 'Claude adaptive thinking',
      value: canDisable && model.thinking?.enabled === false ? 'off' : effort,
      options: canDisable
        ? CLAUDE_QUICK_REASONING_OPTIONS
        : CLAUDE_QUICK_REASONING_OPTIONS.filter(
            (option) => option.value !== 'off',
          ),
    }
  }

  return null
}

export function updateQuickReasoningEffort(
  model: ChatModel,
  value: string,
): ChatModel {
  if (isGptPlanModel(model)) {
    if (!isGptEffortFor(model.model, value)) {
      throw new Error(
        `Unsupported reasoning effort for ${model.model}: ${value}`,
      )
    }

    const reasoning = {
      ...model.reasoning,
      reasoning_effort: value,
    }
    if (value === 'none') {
      delete reasoning.reasoning_summary
    }

    return {
      ...model,
      reasoning,
    }
  }

  if (isClaude5PlanModel(model)) {
    if (value !== 'off' && !isClaudeEffort(value)) {
      throw new Error(`Unsupported Claude reasoning effort: ${value}`)
    }

    const adaptiveThinking =
      model.thinking?.mode === 'adaptive' ? model.thinking : undefined
    const currentEffort = adaptiveThinking?.effort ?? 'high'
    if (
      value === 'off' &&
      !canDisableClaude5Thinking(model.model, currentEffort)
    ) {
      throw new Error(
        `${model.model} requires adaptive thinking at effort ${currentEffort}`,
      )
    }

    return {
      ...model,
      thinking: {
        enabled: value !== 'off',
        mode: 'adaptive',
        effort: value === 'off' ? currentEffort : value,
        display: adaptiveThinking?.display ?? 'summarized',
      },
    }
  }

  throw new Error(`Quick reasoning control is not supported for ${model.model}`)
}
