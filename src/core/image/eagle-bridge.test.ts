import { App } from 'obsidian'

import { getEagleBridge, getEaglePasteBehavior } from './eagle-bridge'

function fakePlugin(overrides: Record<string, unknown> = {}) {
  return {
    settings: { imagePasteBehavior: 'cloud' },
    uploadImageToEagle: jest.fn(),
    getActiveCloudProvider: jest.fn(),
    getActiveCloudProviderName: jest.fn(),
    ...overrides,
  }
}

function appWithPlugins(plugins: Record<string, unknown>): App {
  return { plugins: { plugins } } as unknown as App
}

describe('getEagleBridge', () => {
  it('returns null when the CMDS Eagle plugin is not loaded', () => {
    expect(getEagleBridge(appWithPlugins({}))).toBeNull()
    expect(getEagleBridge({} as App)).toBeNull()
  })

  it('uses the community plugin id only, ignoring forks', () => {
    const upstream = fakePlugin()
    const fork = fakePlugin()

    expect(
      getEagleBridge(
        appWithPlugins({ 'cmds-eagle-vian': fork, 'cmds-eagle': upstream }),
      ),
    ).toBe(upstream)
    expect(
      getEagleBridge(appWithPlugins({ 'cmds-eagle-vian': fork })),
    ).toBeNull()
  })

  it('ignores a plugin instance missing the methods we rely on', () => {
    const broken = fakePlugin({ uploadImageToEagle: undefined })

    expect(getEagleBridge(appWithPlugins({ 'cmds-eagle': broken }))).toBeNull()
  })
})

describe('getEaglePasteBehavior', () => {
  it('reads the paste behaviour from the plugin settings', () => {
    const bridge = getEagleBridge(
      appWithPlugins({ 'cmds-eagle': fakePlugin() }),
    )

    expect(getEaglePasteBehavior(bridge)).toBe('cloud')
    expect(getEaglePasteBehavior(null)).toBeUndefined()
  })
})
