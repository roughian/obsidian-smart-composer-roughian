import {
  getGptPlanDefaultEffort,
  getGptPlanEfforts,
  getGptPlanLowestEffort,
  isGptPlanModel,
} from './openaiPlanModels'

describe('openaiPlanModels', () => {
  it('excludes none from GPT-6 efforts and keeps it for GPT-5.6', () => {
    expect(getGptPlanEfforts('gpt-6-astra')).not.toContain('none')
    expect(getGptPlanEfforts('gpt-5.6-luna')).toContain('none')
  })

  it.each([
    ['gpt-6-astra', 'medium', 'low'],
    ['gpt-5.6-sol', 'medium', 'none'],
    ['gpt-5.6-terra', 'low', 'none'],
    ['gpt-5.6-luna', 'none', 'none'],
  ])('resolves %s default and lowest efforts', (model, fallback, lowest) => {
    expect(isGptPlanModel(model)).toBe(true)
    expect(getGptPlanDefaultEffort(model)).toBe(fallback)
    expect(getGptPlanLowestEffort(model)).toBe(lowest)
  })

  it('returns nothing for unknown models', () => {
    expect(isGptPlanModel('gpt-5.5')).toBe(false)
    expect(getGptPlanEfforts('gpt-5.5')).toBeUndefined()
    expect(getGptPlanDefaultEffort('gpt-5.5')).toBeUndefined()
  })
})
