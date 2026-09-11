import { App } from 'obsidian'

import { EaglePasteBehavior } from './image-destination'

/** The community CMDS Eagle plugin. Forks under other ids are not used. */
export const EAGLE_PLUGIN_ID = 'cmds-eagle'

export type CloudUploadResult = {
  success: boolean
  publicUrl?: string
  error?: string
}

export type CloudProvider = {
  upload(
    absolutePath: string,
    filename: string,
    mimeType: string,
  ): Promise<CloudUploadResult>
}

/**
 * The subset of the CMDS Eagle plugin instance we call into. Delegating keeps
 * Eagle/cloud credentials and link modes in that plugin's own settings.
 */
export type EagleBridge = {
  settings?: { imagePasteBehavior?: EaglePasteBehavior }
  uploadImageToEagle(file: File, notePath: string): Promise<string>
  getActiveCloudProvider(): CloudProvider | null
  getActiveCloudProviderName(): string
}

type PluginRegistry = {
  plugins?: { plugins?: Record<string, unknown> }
}

function isEagleBridge(value: unknown): value is EagleBridge {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.uploadImageToEagle === 'function' &&
    typeof candidate.getActiveCloudProvider === 'function' &&
    typeof candidate.getActiveCloudProviderName === 'function'
  )
}

export function getEagleBridge(app: App): EagleBridge | null {
  const candidate = (app as unknown as PluginRegistry).plugins?.plugins?.[
    EAGLE_PLUGIN_ID
  ]
  return isEagleBridge(candidate) ? candidate : null
}

/** CMDS Eagle's paste behaviour, or undefined when the plugin is absent. */
export function getEaglePasteBehavior(
  bridge: EagleBridge | null,
): EaglePasteBehavior | undefined {
  return bridge?.settings?.imagePasteBehavior
}
