import type { ChatModel } from '../../types/chat-model.types'

export const ANTHROPIC_PLAN_RISK_VERSION = 1 as const

export const PLAN_MODEL_CATALOG: readonly ChatModel[] = [
  {
    providerType: 'anthropic-plan',
    providerId: 'anthropic-plan',
    id: 'claude-fable-5.1 (plan)',
    model: 'claude-fable-5-1',
    thinking: {
      enabled: true,
      mode: 'adaptive',
      effort: 'high',
      display: 'summarized',
    },
  },
  {
    providerType: 'anthropic-plan',
    providerId: 'anthropic-plan',
    id: 'claude-fable-5 (plan)',
    model: 'claude-fable-5',
    thinking: {
      enabled: true,
      mode: 'adaptive',
      effort: 'high',
      display: 'summarized',
    },
  },
  {
    providerType: 'anthropic-plan',
    providerId: 'anthropic-plan',
    id: 'claude-opus-5 (plan)',
    model: 'claude-opus-5',
    thinking: {
      enabled: true,
      mode: 'adaptive',
      effort: 'high',
      display: 'summarized',
    },
  },
  {
    providerType: 'anthropic-plan',
    providerId: 'anthropic-plan',
    id: 'claude-sonnet-5 (plan)',
    model: 'claude-sonnet-5',
    thinking: {
      enabled: true,
      mode: 'adaptive',
      effort: 'high',
      display: 'summarized',
    },
  },
  {
    providerType: 'anthropic-plan',
    providerId: 'anthropic-plan',
    id: 'claude-opus-4.8 (plan)',
    model: 'claude-opus-4-8',
  },
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'gpt-6-astra (plan)',
    model: 'gpt-6-astra',
    reasoning: { reasoning_effort: 'medium' },
  },
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'gpt-5.6-sol (plan)',
    model: 'gpt-5.6-sol',
    reasoning: { reasoning_effort: 'medium' },
  },
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'gpt-5.6-terra (plan)',
    model: 'gpt-5.6-terra',
    reasoning: { reasoning_effort: 'low' },
  },
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'gpt-5.6-luna (plan)',
    model: 'gpt-5.6-luna',
    reasoning: { reasoning_effort: 'none' },
  },
  {
    providerType: 'gemini-plan',
    providerId: 'gemini-plan',
    id: 'gemini-3-pro-preview (plan)',
    model: 'gemini-3-pro-preview',
    enable: false,
  },
  {
    providerType: 'gemini-plan',
    providerId: 'gemini-plan',
    id: 'gemini-3-flash-preview (plan)',
    model: 'gemini-3-flash-preview',
    enable: false,
  },
]

export const LEGACY_PLAN_MODEL_ALIASES: Readonly<Record<string, string>> = {
  'claude-opus-4.5 (plan)': 'claude-opus-4.8 (plan)',
  'claude-sonnet-4.5 (plan)': 'claude-sonnet-5 (plan)',
  'claude-sonnet-4.6 (plan)': 'claude-sonnet-5 (plan)',
  'gpt-5.2 (plan)': 'gpt-5.6-sol (plan)',
  'gpt-5.5 (plan)': 'gpt-5.6-sol (plan)',
}

type ModelRecord = Record<string, unknown> & {
  id?: string
  providerType?: string
  reasoning?: Record<string, unknown>
  thinking?: Record<string, unknown>
}

const PLAN_PROVIDER_TYPES = new Set([
  'anthropic-plan',
  'openai-plan',
  'gemini-plan',
])
const CATALOG_IDS = new Set(PLAN_MODEL_CATALOG.map((model) => model.id))
const LEGACY_IDS = new Set(Object.keys(LEGACY_PLAN_MODEL_ALIASES))

export function mergePlanModelCatalog(
  models: unknown,
): Record<string, unknown>[] {
  const existing = Array.isArray(models) ? (models as ModelRecord[]) : []
  const insertionIndex = Math.max(
    0,
    existing.findIndex((model) =>
      PLAN_PROVIDER_TYPES.has(model.providerType ?? ''),
    ),
  )

  const catalogModels = PLAN_MODEL_CATALOG.map((catalogModel) => {
    const current = existing.find((model) => model.id === catalogModel.id)
    return mergeCatalogModel(catalogModel, current)
  })

  const remaining = existing
    .filter((model) => !CATALOG_IDS.has(model.id ?? ''))
    .map((model) =>
      LEGACY_IDS.has(model.id ?? '')
        ? { ...model, enable: false }
        : { ...model },
    )
  const boundedIndex = Math.min(insertionIndex, remaining.length)
  return [
    ...remaining.slice(0, boundedIndex),
    ...catalogModels,
    ...remaining.slice(boundedIndex),
  ]
}

export function migratePlanModelId(value: unknown): unknown {
  return typeof value === 'string'
    ? (LEGACY_PLAN_MODEL_ALIASES[value] ?? value)
    : value
}

function mergeCatalogModel(
  catalogModel: ChatModel,
  current?: ModelRecord,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...catalogModel,
    ...(typeof current?.enable === 'boolean' ? { enable: current.enable } : {}),
  }

  if ('reasoning' in catalogModel && catalogModel.reasoning) {
    merged.reasoning = {
      ...catalogModel.reasoning,
      ...(current?.reasoning ?? {}),
    }
  }
  if ('thinking' in catalogModel && catalogModel.thinking) {
    merged.thinking = {
      ...catalogModel.thinking,
      ...(current?.thinking ?? {}),
    }
  }
  if (catalogModel.providerType === 'gemini-plan') merged.enable = false
  return merged
}
