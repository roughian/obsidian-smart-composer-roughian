import { extractXaiImage } from './xaiImage'

describe('extractXaiImage', () => {
  it('returns the first base64 payload', () => {
    expect(
      extractXaiImage({ data: [{ url: 'https://x' }, { b64_json: 'QUJD' }] }),
    ).toEqual({ base64: 'QUJD' })
  })

  it('throws when only URLs came back', () => {
    expect(() => extractXaiImage({ data: [{ url: 'https://x' }] })).toThrow(
      'xAI returned no image data',
    )
  })
})
