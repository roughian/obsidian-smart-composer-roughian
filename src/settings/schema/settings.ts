import {
  mergePlanModelCatalog,
  migratePlanModelId,
} from '../../core/llm/planModelCatalog'

import { SETTINGS_SCHEMA_VERSION, SETTING_MIGRATIONS } from './migrations'
import {
  SmartComposerSettings,
  smartComposerSettingsSchema,
} from './setting.types'

function migrateSettings(
  data: Record<string, unknown>,
): Record<string, unknown> {
  let currentData = { ...data }
  let currentVersion = (currentData.version as number) ?? 0

  for (const migration of SETTING_MIGRATIONS) {
    if (
      currentVersion >= migration.fromVersion &&
      currentVersion < migration.toVersion &&
      migration.toVersion <= SETTINGS_SCHEMA_VERSION
    ) {
      console.log(
        `Migrating settings from ${migration.fromVersion} to ${migration.toVersion}`,
      )
      currentData = migration.migrate(currentData)
      currentVersion = migration.toVersion
    }
  }

  return currentData
}

export function parseSmartComposerSettings(
  data: unknown,
): SmartComposerSettings {
  if (
    typeof data !== 'object' ||
    data === null ||
    Object.keys(data).length === 0
  ) {
    return smartComposerSettingsSchema.parse({})
  }

  try {
    const migratedData = migrateSettings(data as Record<string, unknown>)
    const inlineEdit = asRecord(migratedData.inlineEdit)
    const imageGeneration = asRecord(migratedData.imageGeneration)
    const catalogMergedData = {
      ...migratedData,
      chatModels: mergePlanModelCatalog(migratedData.chatModels),
      chatModelId: migratePlanModelId(migratedData.chatModelId),
      applyModelId: migratePlanModelId(migratedData.applyModelId),
      ...(inlineEdit
        ? {
            inlineEdit: {
              ...inlineEdit,
              modelId: migratePlanModelId(inlineEdit.modelId),
            },
          }
        : {}),
      ...(imageGeneration
        ? {
            imageGeneration: {
              ...imageGeneration,
              modelId: migratePlanModelId(imageGeneration.modelId),
            },
          }
        : {}),
    }
    return smartComposerSettingsSchema.parse(catalogMergedData)
  } catch (error) {
    console.warn('Invalid settings provided, using defaults:', error)
    return smartComposerSettingsSchema.parse({})
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}
