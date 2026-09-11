import { MentionableImage } from '../../types/mentionable'

import {
  ImageRejectedError,
  filesToMentionableImages,
  parseImageDataUrl,
} from './image'

function fakeFile(name: string): File {
  return { name, type: 'image/png', size: 10 } as File
}

describe('parseImageDataUrl', () => {
  it('splits a data URL into mime type and payload', () => {
    expect(parseImageDataUrl('data:image/png;base64,AAAA')).toEqual({
      mimeType: 'image/png',
      base64Data: 'AAAA',
    })
  })

  it('rejects strings that are not base64 data URLs', () => {
    expect(() => parseImageDataUrl('https://example.com/a.png')).toThrow(
      'Invalid image data URL format',
    )
  })
})

describe('filesToMentionableImages', () => {
  it('collects converted images and rejection reasons in input order', async () => {
    const convert = async (file: File): Promise<MentionableImage> => {
      if (file.name === 'bad.png') {
        throw new ImageRejectedError('Image exceeds 20 MB.')
      }
      return {
        type: 'image',
        name: file.name,
        mimeType: file.type,
        data: `data:image/png;base64,${file.name}`,
      }
    }

    const result = await filesToMentionableImages(
      [fakeFile('a.png'), fakeFile('bad.png'), fakeFile('b.png')],
      convert,
    )

    expect(result.images.map((image) => image.name)).toEqual(['a.png', 'b.png'])
    expect(result.rejected).toEqual([
      { name: 'bad.png', reason: 'Image exceeds 20 MB.' },
    ])
  })

  it('reports unexpected converter failures as rejections too', async () => {
    const result = await filesToMentionableImages([fakeFile('x.png')], () =>
      Promise.reject(new Error('decoder crashed')),
    )

    expect(result.images).toEqual([])
    expect(result.rejected).toEqual([
      { name: 'x.png', reason: 'decoder crashed' },
    ])
  })
})
