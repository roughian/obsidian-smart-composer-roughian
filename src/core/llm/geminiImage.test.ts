import {
  buildGeminiImageConfig,
  buildGeminiImageContents,
  extractGeminiImage,
} from './geminiImage'

describe('buildGeminiImageContents', () => {
  it('places reference images before the prompt as inline data', () => {
    expect(
      buildGeminiImageContents('a cat', ['data:image/png;base64,QUJD']),
    ).toEqual([
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/png', data: 'QUJD' } },
          { text: 'a cat' },
        ],
      },
    ])
  })
})

describe('buildGeminiImageConfig', () => {
  it('requests 2K only for high quality', () => {
    expect(buildGeminiImageConfig('high').imageConfig.imageSize).toBe('2K')
    expect(buildGeminiImageConfig('low').imageConfig.imageSize).toBe('1K')
    expect(buildGeminiImageConfig('medium').responseModalities).toEqual([
      'TEXT',
      'IMAGE',
    ])
  })
})

describe('extractGeminiImage', () => {
  it('returns the first inline image part', () => {
    expect(
      extractGeminiImage({
        candidates: [
          {
            content: {
              parts: [
                { text: 'Here you go' },
                { inlineData: { mimeType: 'image/png', data: 'QUJD' } },
              ],
            },
          },
        ],
      }),
    ).toEqual({ base64: 'QUJD', mimeType: 'image/png' })
  })

  it('throws when the response carries no image', () => {
    expect(() =>
      extractGeminiImage({
        candidates: [{ content: { parts: [{ text: 'refused' }] } }],
      }),
    ).toThrow('Gemini returned no image')
  })
})
