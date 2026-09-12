import {
  API_IMAGE_MODEL_CATALOG,
  isApiImageModel,
  mergeImageModelCatalog,
} from './image-model-catalog'

describe('mergeImageModelCatalog', () => {
  it('appends every catalog model to an empty list', () => {
    expect(mergeImageModelCatalog([])).toEqual(API_IMAGE_MODEL_CATALOG)
  })

  it('keeps existing entries untouched and only adds the missing ones', () => {
    const disabled = {
      ...API_IMAGE_MODEL_CATALOG[0],
      enable: false,
    }
    const custom = { id: 'my-model', providerType: 'openai', model: 'x' }

    const merged = mergeImageModelCatalog([custom, disabled])

    expect(merged[0]).toEqual(custom)
    expect(merged[1]).toEqual(disabled)
    expect(merged.slice(2)).toEqual(API_IMAGE_MODEL_CATALOG.slice(1))
  })

  it('is idempotent', () => {
    const once = mergeImageModelCatalog([])
    expect(mergeImageModelCatalog(once)).toEqual(once)
  })
})

describe('isApiImageModel', () => {
  it.each([
    ['gemini', 'gemini-3.1-flash-image', true],
    ['gemini', 'gemini-2.5-flash-image', true],
    ['gemini', 'gemini-3-pro-preview', false],
    ['xai', 'grok-imagine-image-2.0', true],
    ['xai', 'grok-4-1-fast', false],
    ['openai', 'gemini-3.1-flash-image', false],
  ] as const)('%s / %s → %s', (providerType, model, expected) => {
    expect(isApiImageModel({ providerType, model })).toBe(expected)
  })
})
