import {
  buildEagleEmbedMarkdown,
  buildEagleOriginalPath,
  pathToFileUrl,
} from './eagle-paths'

const item = { id: 'KXYZ01', name: 'night harbor', ext: 'png' }

describe('buildEagleOriginalPath', () => {
  it('points inside the item info folder and tolerates a trailing slash', () => {
    expect(buildEagleOriginalPath('/Users/me/Photos.library/', item)).toBe(
      '/Users/me/Photos.library/images/KXYZ01.info/night harbor.png',
    )
  })
})

describe('pathToFileUrl', () => {
  it('encodes spaces and keeps the absolute root', () => {
    expect(pathToFileUrl('/Users/me/a b.png')).toBe(
      'file:///Users/me/a%20b.png',
    )
  })

  it('converts Windows separators', () => {
    expect(pathToFileUrl('C:\\Eagle\\x.png')).toBe('file:///C:/Eagle/x.png')
  })
})

describe('buildEagleEmbedMarkdown', () => {
  it('links the rendered original to the eagle:// item', () => {
    expect(
      buildEagleEmbedMarkdown({
        item,
        originalPath: '/lib/images/KXYZ01.info/night harbor.png',
      }),
    ).toBe(
      '[![night harbor](file:///lib/images/KXYZ01.info/night%20harbor.png)](eagle://item/KXYZ01)',
    )
  })
})
