import { ChatModel } from '../../types/chat-model.types'
import { getClaude5PlanFamily } from '../llm/claudePlanModels'
import { getGptPlanLowestEffort } from '../llm/openaiPlanModels'

/** Returns a copy suitable for deterministic, low-token internal RAG calls. */
export function getInternalRagModel(model: ChatModel): ChatModel {
  const lowestGptEffort =
    model.providerType === 'openai-plan'
      ? getGptPlanLowestEffort(model.model)
      : undefined
  if (model.providerType === 'openai-plan' && lowestGptEffort) {
    return {
      ...model,
      reasoning: {
        reasoning_effort: lowestGptEffort,
      },
    }
  }

  if (model.providerType === 'anthropic-plan') {
    const family = getClaude5PlanFamily(model.model)
    if (!family) {
      return 'thinking' in model
        ? ({ ...model, thinking: undefined } as ChatModel)
        : model
    }
    const adaptive =
      model.thinking?.mode === 'adaptive' ? model.thinking : undefined
    return {
      ...model,
      thinking: {
        enabled: family === 'fable',
        mode: 'adaptive',
        effort: family === 'fable' ? 'low' : 'high',
        display: adaptive?.display ?? 'summarized',
      },
    }
  }

  if ('thinking' in model) {
    return { ...model, thinking: undefined } as ChatModel
  }
  if ('reasoning' in model) {
    return { ...model, reasoning: undefined } as ChatModel
  }
  return model
}

/** Only authentication failure prevents a useful local retrieval fallback. */
export function shouldSurfacePlanRequestError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  const status = 'status' in error ? error.status : undefined
  return status === 401
}

export function describePlanRequestError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Plan retrieval failed; local ranking was used.'
  }
  const status = 'status' in error ? String(error.status) : ''
  const suffix = status ? ` (HTTP ${status})` : ''
  return `Plan retrieval failed${suffix}; local ranking was used.`
}
