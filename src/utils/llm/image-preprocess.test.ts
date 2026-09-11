import {
  MAX_IMAGE_FILE_BYTES,
  MAX_IMAGE_SIDE_PX,
  dataUrlByteSize,
  fitWithinMaxSide,
  getImagePreprocessPlan,
} from './image-preprocess'

describe('dataUrlByteSize', () => {
  it.each([
    ['data:image/png;base64,AAAA', 3],
    ['data:image/png;base64,AAA=', 2],
    ['data:image/png;base64,AA==', 1],
  ])('decodes the payload length of %s', (dataUrl, bytes) => {
    expect(dataUrlByteSize(dataUrl)).toBe(bytes)
  })
})

describe('fitWithinMaxSide', () => {
  it('keeps dimensions that already fit', () => {
    expect(fitWithinMaxSide({ width: 800, height: 600 }, 2048)).toEqual({
      width: 800,
      height: 600,
    })
  })

  it('scales the longest side down while preserving aspect ratio', () => {
    expect(fitWithinMaxSide({ width: 4096, height: 1024 }, 2048)).toEqual({
      width: 2048,
      height: 512,
    })
    expect(fitWithinMaxSide({ width: 1000, height: 5000 }, 2048)).toEqual({
      width: 410,
      height: 2048,
    })
  })
})

describe('getImagePreprocessPlan', () => {
  it('keeps supported images within limits untouched', () => {
    expect(
      getImagePreprocessPlan({
        mimeType: 'image/jpeg',
        byteSize: 1024,
        width: MAX_IMAGE_SIDE_PX,
        height: 100,
      }),
    ).toEqual({ action: 'keep' })
  })

  it('re-encodes oversized files even when their dimensions already fit', () => {
    expect(
      getImagePreprocessPlan({
        mimeType: 'image/png',
        byteSize: MAX_IMAGE_FILE_BYTES + 1,
        width: 1600,
        height: 900,
      }),
    ).toEqual({
      action: 'reencode',
      width: 1600,
      height: 900,
      mimeType: 'image/png',
    })
  })

  it('re-encodes unsupported formats to png at their original size', () => {
    expect(
      getImagePreprocessPlan({
        mimeType: 'image/bmp',
        byteSize: 1024,
        width: 640,
        height: 480,
      }),
    ).toEqual({
      action: 'reencode',
      width: 640,
      height: 480,
      mimeType: 'image/png',
    })
  })

  it('downsizes oversized images while keeping a supported mime type', () => {
    expect(
      getImagePreprocessPlan({
        mimeType: 'image/webp',
        byteSize: 1024,
        width: 5000,
        height: 2500,
      }),
    ).toEqual({
      action: 'reencode',
      width: 2048,
      height: 1024,
      mimeType: 'image/webp',
    })
  })

  it('converts oversized gifs to png because animation cannot survive', () => {
    expect(
      getImagePreprocessPlan({
        mimeType: 'image/gif',
        byteSize: 1024,
        width: 3000,
        height: 3000,
      }),
    ).toMatchObject({ action: 'reencode', mimeType: 'image/png' })
  })
})
