import {
  App,
  FileSystemAdapter,
  Platform,
  TFile,
  base64ToArrayBuffer,
  normalizePath,
} from 'obsidian'
import { v4 as uuidv4 } from 'uuid'

import { SmartComposerSettings } from '../../settings/schema/setting.types'
import {
  ArtifactRecord,
  BackgroundTaskAdapter,
  BackgroundTaskRecord,
  BackgroundTaskRunContext,
  BackgroundTaskRunResult,
} from '../../types/background-task'
import { getChatModelClient } from '../llm/manager'
import { getProviderCapabilities } from '../llm/providerCapabilities'
import { BackgroundTaskManager } from '../tasks/BackgroundTaskManager'

import { getEagleBridge, getEaglePasteBehavior } from './eagle-bridge'
import { ImageDeliveryResult, deliverGeneratedImage } from './image-delivery'
import { resolveImageDestination } from './image-destination'
import { isImageGenerator } from './image-generator'
import { loadReferenceImageDataUrls } from './reference-image-store'

export class PlanImageTaskAdapter implements BackgroundTaskAdapter {
  readonly kind = 'image-generation' as const

  private loadReferenceImages(task: BackgroundTaskRecord): Promise<string[]> {
    const raw = task.input.referenceImagePaths
    const paths = Array.isArray(raw)
      ? raw.filter((path): path is string => typeof path === 'string')
      : []
    return loadReferenceImageDataUrls({ app: this.app, paths })
  }

  private deliver(
    task: BackgroundTaskRecord,
    localPath: string,
    bytes: ArrayBuffer,
    mimeType: string,
  ): Promise<ImageDeliveryResult> {
    const settings = this.getSettings()
    const adapter = this.app.vault.adapter
    const bridge = getEagleBridge(this.app)
    return deliverGeneratedImage(
      {
        destination: resolveImageDestination({
          requested: task.input.destination,
          configured: settings.imageGeneration.destination,
          pasteBehavior: getEaglePasteBehavior(bridge),
        }),
        localPath,
        notePath:
          typeof task.input.targetFilePath === 'string'
            ? task.input.targetFilePath
            : '',
        bytes,
        mimeType,
      },
      {
        bridge,
        resolveAbsolutePath: (path) =>
          adapter instanceof FileSystemAdapter
            ? `${adapter.getBasePath()}/${path}`
            : null,
        trashLocalCopy: async (path) => {
          const file = this.app.vault.getAbstractFileByPath(path)
          if (file instanceof TFile) await this.app.fileManager.trashFile(file)
        },
      },
    )
  }

  constructor(
    private readonly app: App,
    private readonly taskManager: BackgroundTaskManager,
    private readonly getSettings: () => SmartComposerSettings,
    private readonly setSettings: (
      settings: SmartComposerSettings,
    ) => void | Promise<void>,
  ) {}

  async run(
    task: BackgroundTaskRecord,
    context: BackgroundTaskRunContext,
  ): Promise<BackgroundTaskRunResult> {
    if (!Platform.isDesktop) {
      throw new Error(
        'Plan image generation currently requires Obsidian desktop.',
      )
    }
    const prompt =
      typeof task.input.prompt === 'string' ? task.input.prompt.trim() : ''
    if (!prompt) throw new Error('Image prompt is empty.')

    const settings = this.getSettings()
    const requestedModelId =
      typeof task.input.modelId === 'string'
        ? task.input.modelId
        : settings.imageGeneration.modelId
    const { providerClient, model } = getChatModelClient({
      modelId: requestedModelId,
      settings,
      setSettings: this.setSettings,
    })
    if (
      !getProviderCapabilities(model).imageGeneration ||
      !isImageGenerator(providerClient)
    ) {
      throw new Error(`Model "${model.id}" does not support image generation.`)
    }

    await context.updateProgress({
      phase: 'preparing',
      message: 'Preparing image request',
    })
    const referenceImages = await this.loadReferenceImages(task)
    const generated = await providerClient.generateImage(model, prompt, {
      quality: settings.imageGeneration.quality,
      referenceImages,
      signal: context.signal,
      onProgress: (phase, partialImageIndex) => {
        void context.updateProgress({
          phase,
          current: partialImageIndex,
          message:
            phase === 'receiving'
              ? 'Receiving image preview'
              : 'Generating image',
        })
      },
    })

    await context.updateProgress({
      phase: 'saving',
      message: 'Saving recoverable local image',
    })
    const bytes = base64ToArrayBuffer(generated.base64)
    const mimeType =
      sniffImageMimeType(bytes) ?? generated.mimeType ?? 'image/png'
    const dimensions = readPngDimensions(bytes)
    const folder = normalizePath(settings.imageGeneration.outputFolder)
    await ensureFolder(this.app, folder)
    const filename = `${Date.now()}-${
      sanitizeFilename(prompt.slice(0, 48)) || 'generated-image'
    }.${IMAGE_EXTENSION_BY_MIME[mimeType] ?? 'png'}`
    const path = await getAvailablePath(this.app, folder, filename)
    await this.app.vault.createBinary(path, bytes)
    await context.updateProgress({
      phase: 'delivering',
      message: 'Storing image at its destination',
    })
    const delivery = await this.deliver(task, path, bytes, mimeType)

    const artifact: ArtifactRecord = {
      schemaVersion: 1,
      id: uuidv4(),
      taskId: task.id,
      kind: 'image',
      createdAt: Date.now(),
      localPath: delivery.localPath,
      metadata: {
        destination: delivery.destination,
        markdown: delivery.markdown,
        ...(delivery.error ? { destinationError: delivery.error } : {}),
      },
      mimeType,
      byteSize: bytes.byteLength,
      width: dimensions?.width,
      height: dimensions?.height,
      checksum: await sha256(bytes),
    }
    await this.taskManager.saveArtifact(artifact)
    await context.updateProgress({
      phase: 'ready',
      message: 'Image ready',
    })
    return { status: 'succeeded', artifactIds: [artifact.id] }
  }
}

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46]
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50]
const WEBP_TAG_OFFSET = 8

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value)
}

/** Providers do not always declare the format (Grok returns JPEG), so read the magic bytes. */
export function sniffImageMimeType(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 12))
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png'
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg'
  if (
    startsWith(bytes, WEBP_RIFF) &&
    startsWith(bytes, WEBP_TAG, WEBP_TAG_OFFSET)
  ) {
    return 'image/webp'
  }
  return null
}

export function readPngDimensions(
  buffer: ArrayBuffer,
): { width: number; height: number } | null {
  if (buffer.byteLength < 24) return null
  const bytes = new Uint8Array(buffer, 0, 24)
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (signature.some((value, index) => bytes[index] !== value)) return null
  const view = new DataView(buffer)
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  }
}

async function ensureFolder(app: App, path: string): Promise<void> {
  if (!path || app.vault.getAbstractFileByPath(path)) return
  const parts = path.split('/')
  let current = ''
  for (const part of parts) {
    current = current ? `${current}/${part}` : part
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current)
    }
  }
}

async function getAvailablePath(
  app: App,
  folder: string,
  filename: string,
): Promise<string> {
  const dot = filename.lastIndexOf('.')
  const stem = dot >= 0 ? filename.slice(0, dot) : filename
  const extension = dot >= 0 ? filename.slice(dot) : ''
  for (let index = 0; index < Number.MAX_SAFE_INTEGER; index += 1) {
    const suffix = index === 0 ? '' : `-${index}`
    const candidate = normalizePath(`${folder}/${stem}${suffix}${extension}`)
    if (!app.vault.getAbstractFileByPath(candidate)) return candidate
  }
  throw new Error('Unable to allocate a unique image filename.')
}

function sanitizeFilename(value: string): string {
  return value
    .replace(/[\\/:*?"<>|#^[\]]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
