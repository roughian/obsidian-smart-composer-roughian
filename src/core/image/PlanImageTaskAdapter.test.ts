import { readPngDimensions, sniffImageMimeType } from './PlanImageTaskAdapter'

describe('readPngDimensions', () => {
  it('reads dimensions from a PNG IHDR header', () => {
    const bytes = new Uint8Array(24)
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
    const view = new DataView(bytes.buffer)
    view.setUint32(16, 1920, false)
    view.setUint32(20, 1080, false)

    expect(readPngDimensions(bytes.buffer)).toEqual({
      width: 1920,
      height: 1080,
    })
  })

  it('rejects a non-PNG payload', () => {
    expect(readPngDimensions(new ArrayBuffer(24))).toBeNull()
  })
})

describe('sniffImageMimeType', () => {
  it.each([
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/png'],
    [[0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46], 'image/jpeg'],
    [
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
      'image/webp',
    ],
    [[0x00, 0x01, 0x02], null],
  ])('identifies %j as %s', (bytes, expected) => {
    expect(sniffImageMimeType(new Uint8Array(bytes).buffer)).toBe(expected)
  })
})
