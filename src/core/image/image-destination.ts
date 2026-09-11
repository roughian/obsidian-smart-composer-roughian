/** Setting values: keep the file in the vault, or follow the CMDS Eagle plugin. */
export const IMAGE_DESTINATIONS = ['vault', 'cmds-eagle'] as const

export type ImageDestination = (typeof IMAGE_DESTINATIONS)[number]

/** Where a generated image actually ends up. */
export const RESOLVED_IMAGE_DESTINATIONS = ['vault', 'eagle', 'cloud'] as const

export type ResolvedImageDestination =
  (typeof RESOLVED_IMAGE_DESTINATIONS)[number]

/** CMDS Eagle's own "where to save pasted images" setting. */
export type EaglePasteBehavior = 'eagle' | 'local' | 'cloud' | 'ask'

export const DEFAULT_IMAGE_DESTINATION: ImageDestination = 'vault'

export const IMAGE_DESTINATION_LABELS: Record<ImageDestination, string> = {
  vault: 'Vault folder',
  'cmds-eagle': 'CMDS Eagle (sync)',
}

export const RESOLVED_IMAGE_DESTINATION_LABELS: Record<
  ResolvedImageDestination,
  string
> = {
  vault: 'Vault folder',
  eagle: 'Eagle',
  cloud: 'Cloud',
}

export function isImageDestination(value: unknown): value is ImageDestination {
  return (
    typeof value === 'string' &&
    (IMAGE_DESTINATIONS as readonly string[]).includes(value)
  )
}

export function isResolvedImageDestination(
  value: unknown,
): value is ResolvedImageDestination {
  return (
    typeof value === 'string' &&
    (RESOLVED_IMAGE_DESTINATIONS as readonly string[]).includes(value)
  )
}

/** Maps CMDS Eagle's paste behaviour onto a storage target; `ask` needs a prompt. */
export function destinationFromPasteBehavior(
  behavior: EaglePasteBehavior | undefined,
): ResolvedImageDestination | 'ask' {
  if (behavior === 'local') return 'vault'
  if (behavior === 'cloud' || behavior === 'ask') return behavior
  return 'eagle'
}

/**
 * The per-request choice (from the "ask" prompt) wins. Otherwise the vault
 * setting stays in the vault and the sync setting follows CMDS Eagle, with an
 * unresolved "ask" defaulting to Eagle so a background task never blocks.
 */
export function resolveImageDestination({
  requested,
  configured,
  pasteBehavior,
}: {
  requested: unknown
  configured: ImageDestination
  pasteBehavior: EaglePasteBehavior | undefined
}): ResolvedImageDestination {
  if (isResolvedImageDestination(requested)) return requested
  if (configured === 'vault') return 'vault'
  const synced = destinationFromPasteBehavior(pasteBehavior)
  return synced === 'ask' ? 'eagle' : synced
}
