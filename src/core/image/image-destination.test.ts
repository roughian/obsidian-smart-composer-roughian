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

  it.each([
    ['vault', 'vault'],
    ['eagle', 'eagle'],
  ] as const)('maps the %s setting straight to %s', (configured, expected) => {
    expect(
      resolveImageDestination({
        requested: undefined,
        configured,
        pasteBehavior: 'cloud',
      }),
    ).toBe(expected)
  })

  it.each([
    ['eagle', 'cmds-eagle'],
    ['cloud', 'cloud'],
    ['local', 'vault'],
    ['ask', 'cmds-eagle'],
    [undefined, 'cmds-eagle'],
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
    ['eagle', true],
    ['cmds-eagle', true],
    ['cloud', false],
    [42, false],
  ])('classifies %j as %s', (value, expected) => {
    expect(isImageDestination(value)).toBe(expected)
  })
})

describe('IMAGE_DESTINATION_LABELS', () => {
  it('labels all three settings', () => {
    expect(Object.keys(IMAGE_DESTINATION_LABELS).sort()).toEqual([
      'cmds-eagle',
      'eagle',
      'vault',
    ])
  })
})
