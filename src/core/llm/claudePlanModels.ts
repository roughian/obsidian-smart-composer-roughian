import type { ClaudeEffort } from '../../types/chat-model.types'

export type Claude5PlanFamily = 'fable' | 'opus' | 'sonnet'

export function getClaude5PlanFamily(model: string): Claude5PlanFamily | null {
  const match = /^claude-(fable|opus|sonnet)-5(?:-|$)/.exec(model)
  return (match?.[1] as Claude5PlanFamily | undefined) ?? null
}

export function canDisableClaude5Thinking(
  model: string,
  effort: ClaudeEffort,
): boolean {
  const family = getClaude5PlanFamily(model)
  if (family === 'fable') return false
  if (family === 'opus' && (effort === 'xhigh' || effort === 'max')) {
    return false
  }
  return family !== null
}
