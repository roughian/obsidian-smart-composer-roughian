import { EagleBridge } from './eagle-bridge'
import { ResolvedImageDestination } from './image-destination'

export type ImageDeliveryInput = {
  destination: ResolvedImageDestination
  localPath: string
  notePath: string
  bytes: ArrayBuffer
  mimeType: string
}

export type ImageDeliveryDeps = {
  bridge: EagleBridge | null
  resolveAbsolutePath: (localPath: string) => string | null
  trashLocalCopy: (localPath: string) => Promise<void>
}

export type ImageDeliveryResult = {
  destination: ResolvedImageDestination
  /** Markdown that references the image wherever it now lives. */
  markdown: string
  /** Still set when the vault copy was kept (vault destination or fallback). */
  localPath?: string
  /** Why an Eagle/cloud hand-off fell back to the vault copy. */
  error?: string
}

export function buildVaultEmbed(localPath: string): string {
  return `![[${localPath}]]`
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

function keptInVault(localPath: string, error?: string): ImageDeliveryResult {
  return {
    destination: 'vault',
    markdown: buildVaultEmbed(localPath),
    localPath,
    ...(error ? { error } : {}),
  }
}

async function deliverToEagle(
  input: ImageDeliveryInput,
  deps: ImageDeliveryDeps,
): Promise<ImageDeliveryResult> {
  if (!deps.bridge) {
    throw new Error('CMDS Eagle plugin is not installed or enabled.')
  }
  const file = new File([input.bytes], basename(input.localPath), {
    type: input.mimeType,
  })
  const markdown = await deps.bridge.uploadImageToEagle(file, input.notePath)
  await deps.trashLocalCopy(input.localPath)
  return { destination: 'eagle', markdown }
}

async function deliverToCloud(
  input: ImageDeliveryInput,
  deps: ImageDeliveryDeps,
): Promise<ImageDeliveryResult> {
  const provider = deps.bridge?.getActiveCloudProvider() ?? null
  if (!deps.bridge || !provider) {
    throw new Error('No cloud provider is configured in CMDS Eagle.')
  }
  const absolutePath = deps.resolveAbsolutePath(input.localPath)
  if (!absolutePath) {
    throw new Error('Cloud upload needs a local file system vault.')
  }
  const filename = basename(input.localPath)
  const result = await provider.upload(absolutePath, filename, input.mimeType)
  if (!result.success || !result.publicUrl) {
    throw new Error(result.error ?? 'Cloud upload failed.')
  }
  await deps.trashLocalCopy(input.localPath)
  return {
    destination: 'cloud',
    markdown: `![${filename}](${result.publicUrl})`,
  }
}

/**
 * Hands the saved vault file to its destination. Eagle/cloud failures never
 * lose the image: the vault copy is kept and the reason is reported.
 */
export async function deliverGeneratedImage(
  input: ImageDeliveryInput,
  deps: ImageDeliveryDeps,
): Promise<ImageDeliveryResult> {
  if (input.destination === 'vault') return keptInVault(input.localPath)
  try {
    return input.destination === 'eagle'
      ? await deliverToEagle(input, deps)
      : await deliverToCloud(input, deps)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return keptInVault(input.localPath, message)
  }
}
