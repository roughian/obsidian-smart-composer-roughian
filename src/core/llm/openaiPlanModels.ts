import {
  GPT_5_6_EFFORTS,
  GPT_6_EFFORTS,
  Gpt56Effort,
} from '../../types/chat-model.types'

type GptPlanModelRule = {
  efforts: readonly Gpt56Effort[]
  defaultEffort: Gpt56Effort
}

const GPT_PLAN_MODEL_RULES: Readonly<Record<string, GptPlanModelRule>> = {
  'gpt-6-astra': { efforts: GPT_6_EFFORTS, defaultEffort: 'medium' },
  'gpt-5.6-sol': { efforts: GPT_5_6_EFFORTS, defaultEffort: 'medium' },
  'gpt-5.6-terra': { efforts: GPT_5_6_EFFORTS, defaultEffort: 'low' },
  'gpt-5.6-luna': { efforts: GPT_5_6_EFFORTS, defaultEffort: 'none' },
}

export function isGptPlanModel(model: string): boolean {
  return model in GPT_PLAN_MODEL_RULES
}

export function getGptPlanEfforts(
  model: string,
): readonly Gpt56Effort[] | undefined {
  return GPT_PLAN_MODEL_RULES[model]?.efforts
}

export function getGptPlanDefaultEffort(
  model: string,
): Gpt56Effort | undefined {
  return GPT_PLAN_MODEL_RULES[model]?.defaultEffort
}

/** Lowest effort the model accepts; used for cheap internal calls. */
export function getGptPlanLowestEffort(model: string): Gpt56Effort | undefined {
  return GPT_PLAN_MODEL_RULES[model]?.efforts[0]
}
