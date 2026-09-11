import { App } from 'obsidian'

import { MentionableImage } from '../../types/mentionable'

import {
  REFERENCE_IMAGE_DIR,
  loadReferenceImageDataUrls,
  storeReferenceImages,
} from './reference-image-store'

function createApp() {
  const files = new Map<string, ArrayBuffer>()
  const directories = new Set<string>()
  const adapter = {
    exists: jest.fn(async (path: string) => directories.has(path)),
    mkdir: jest.fn(async (path: string) => {
      directories.add(path)
    }),
    writeBinary: jest.fn(async (path: string, data: ArrayBuffer) => {
      files.set(path, data)
    }),
    readBinary: jest.fn(async (path: string) => {
      const data = files.get(path)
      if (!data) throw new Error(`missing ${path}`)
      return data
    }),
  }
  return { app: { vault: { adapter } } as unknown as App, files, directories }
}

function image(
  name: string,
  mimeType: string,
  base64: string,
): MentionableImage {
  return {
    type: 'image',
    name,
    mimeType,
    data: `data:${mimeType};base64,${base64}`,
  }
}

describe('reference image store', () => {
  it('writes each image under the batch id with a mime-derived extension', async () => {
    const { app, files, directories } = createApp()

    const paths = await storeReferenceImages({
      app,
      batchId: 'msg-1',
      images: [
        image('a.png', 'image/png', 'AAEC'),
        image('b.jpg', 'image/jpeg', 'AwQF'),
      ],
    })

    expect(paths).toEqual([
      `${REFERENCE_IMAGE_DIR}/msg-1-0.png`,
      `${REFERENCE_IMAGE_DIR}/msg-1-1.jpg`,
    ])
    expect(directories.has(REFERENCE_IMAGE_DIR)).toBe(true)
    const stored = files.get(paths[0])
    expect(stored && Array.from(new Uint8Array(stored))).toEqual([0, 1, 2])
  })

  it('returns no paths and touches nothing without images', async () => {
    const { app, files } = createApp()

    await expect(
      storeReferenceImages({ app, batchId: 'msg-2', images: [] }),
    ).resolves.toEqual([])
    expect(files.size).toBe(0)
  })

  it('round-trips stored images back into data URLs', async () => {
    const { app } = createApp()
    const paths = await storeReferenceImages({
      app,
      batchId: 'msg-3',
      images: [image('c.webp', 'image/webp', 'BgcI')],
    })

    await expect(loadReferenceImageDataUrls({ app, paths })).resolves.toEqual([
      'data:image/webp;base64,BgcI',
    ])
  })
})
