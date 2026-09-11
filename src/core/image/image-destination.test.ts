import {
  IMAGE_DESTINATION_LABELS,
  destinationFromPasteBehavior,
  isImageDestination,
  resolveImageDestination,
} from './image-destination'

describe('resolveImageDestination', () => {
  it('prefers the per-request choice over everything else', () => {
    expect(
      resolveImageDestination({
        requested: 'cloud',
        configured: 'vault',
        pasteBehavior: 'eagle',
      }),
    ).toBe('cloud')
  })

  it('stays in the vault when the setting says vault', () => {
    expect(
      resolveImageDestination({
        requested: undefined,
        configured: 'vault',
        pasteBehavior: 'eagle',
      }),
    ).toBe('vault')
  })

  it.each([
    ['eagle', 'eagle'],
    ['cloud', 'cloud'],
    ['local', 'vault'],
    ['ask', 'eagle'],
    [undefined, 'eagle'],
  ] as const)(
    'follows CMDS Eagle paste behaviour %s as %s when syncing',
    (behavior, expected) => {
      expect(
        resolveImageDestination({
          requested: 'bogus',
          configured: 'cmds-eagle',
          pasteBehavior: behavior,
        }),
      ).toBe(expected)
    },
  )
})

describe('destinationFromPasteBehavior', () => {
  it('keeps ask as a prompt request', () => {
    expect(destinationFromPasteBehavior('ask')).toBe('ask')
  })
})

describe('isImageDestination', () => {
  it.each([
    ['vault', true],
    ['cmds-eagle', true],
    ['eagle', false],
    [42, false],
  ])('classifies %j as %s', (value, expected) => {
    expect(isImageDestination(value)).toBe(expected)
  })
})

describe('IMAGE_DESTINATION_LABELS', () => {
  it('labels both settings', () => {
    expect(Object.keys(IMAGE_DESTINATION_LABELS).sort()).toEqual([
      'cmds-eagle',
      'vault',
    ])
  })
})
