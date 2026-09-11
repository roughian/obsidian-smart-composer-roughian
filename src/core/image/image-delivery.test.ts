import { EagleBridge } from './eagle-bridge'
import {
  ImageDeliveryDeps,
  ImageDeliveryInput,
  deliverGeneratedImage,
} from './image-delivery'

const input: ImageDeliveryInput = {
  destination: 'vault',
  localPath: 'Generated/circle.png',
  notePath: 'Notes/today.md',
  bytes: new Uint8Array([1, 2, 3]).buffer,
}

function fakeBridge(overrides: Partial<EagleBridge> = {}): EagleBridge {
  return {
    uploadImageToEagle: jest
      .fn()
      .mockResolvedValue(
        '[![circle](file:///lib/circle.png)](eagle://item/ID1)',
      ),
    getActiveCloudProvider: jest.fn().mockReturnValue(null),
    getActiveCloudProviderName: jest.fn().mockReturnValue('ImgHippo'),
    ...overrides,
  }
}

function deps(overrides: Partial<ImageDeliveryDeps> = {}): ImageDeliveryDeps {
  return {
    bridge: null,
    resolveAbsolutePath: (path) => `/vault/${path}`,
    trashLocalCopy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('deliverGeneratedImage', () => {
  it('keeps the vault copy and embeds it for the vault destination', async () => {
    const trash = jest.fn()

    await expect(
      deliverGeneratedImage(input, deps({ trashLocalCopy: trash })),
    ).resolves.toEqual({
      destination: 'vault',
      markdown: '![[Generated/circle.png]]',
      localPath: 'Generated/circle.png',
    })
    expect(trash).not.toHaveBeenCalled()
  })

  it('imports into Eagle through the plugin and trashes the vault copy', async () => {
    const bridge = fakeBridge()
    const trash = jest.fn().mockResolvedValue(undefined)

    const result = await deliverGeneratedImage(
      { ...input, destination: 'eagle' },
      deps({ bridge, trashLocalCopy: trash }),
    )

    expect(result).toEqual({
      destination: 'eagle',
      markdown: '[![circle](file:///lib/circle.png)](eagle://item/ID1)',
    })
    const [file, notePath] = (bridge.uploadImageToEagle as jest.Mock).mock
      .calls[0] as [File, string]
    expect(file.name).toBe('circle.png')
    expect(file.type).toBe('image/png')
    expect(notePath).toBe('Notes/today.md')
    expect(trash).toHaveBeenCalledWith('Generated/circle.png')
  })

  it('falls back to the vault copy when the Eagle plugin is missing', async () => {
    const trash = jest.fn()

    await expect(
      deliverGeneratedImage(
        { ...input, destination: 'eagle' },
        deps({ trashLocalCopy: trash }),
      ),
    ).resolves.toEqual({
      destination: 'vault',
      markdown: '![[Generated/circle.png]]',
      localPath: 'Generated/circle.png',
      error: 'CMDS Eagle plugin is not installed or enabled.',
    })
    expect(trash).not.toHaveBeenCalled()
  })

  it('reports the Eagle error and keeps the file when the import throws', async () => {
    const bridge = fakeBridge({
      uploadImageToEagle: jest
        .fn()
        .mockRejectedValue(new Error('Eagle is not running')),
    })

    const result = await deliverGeneratedImage(
      { ...input, destination: 'eagle' },
      deps({ bridge }),
    )

    expect(result.destination).toBe('vault')
    expect(result.error).toBe('Eagle is not running')
  })

  it('uploads to the active cloud provider with the absolute path', async () => {
    const upload = jest.fn().mockResolvedValue({
      success: true,
      publicUrl: 'https://cdn.example/circle.png',
    })
    const bridge = fakeBridge({
      getActiveCloudProvider: jest.fn().mockReturnValue({ upload }),
    })
    const trash = jest.fn().mockResolvedValue(undefined)

    await expect(
      deliverGeneratedImage(
        { ...input, destination: 'cloud' },
        deps({ bridge, trashLocalCopy: trash }),
      ),
    ).resolves.toEqual({
      destination: 'cloud',
      markdown: '![circle.png](https://cdn.example/circle.png)',
    })
    expect(upload).toHaveBeenCalledWith(
      '/vault/Generated/circle.png',
      'circle.png',
      'image/png',
    )
    expect(trash).toHaveBeenCalledWith('Generated/circle.png')
  })

  it('keeps the file when no cloud provider is configured', async () => {
    const result = await deliverGeneratedImage(
      { ...input, destination: 'cloud' },
      deps({ bridge: fakeBridge() }),
    )

    expect(result.error).toBe('No cloud provider is configured in CMDS Eagle.')
    expect(result.localPath).toBe('Generated/circle.png')
  })

  it('surfaces the provider error when the upload fails', async () => {
    const bridge = fakeBridge({
      getActiveCloudProvider: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ success: false, error: '403' }),
      }),
    })

    const result = await deliverGeneratedImage(
      { ...input, destination: 'cloud' },
      deps({ bridge }),
    )

    expect(result.error).toBe('403')
  })
})
