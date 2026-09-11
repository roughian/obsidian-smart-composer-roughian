import {
  mergePlanModelCatalog,
  migratePlanModelId,
} from '../../../core/llm/planModelCatalog'
import { SettingMigration } from '../setting.types'

import { DEFAULT_PROVIDERS_V16 } from './15_to_16'
import { getMigratedProviders } from './migrationUtils'

const DEFAULT_IMAGE_MODEL_ID = 'gpt-5.6-sol (plan)'

export const migrateFrom16To17: SettingMigration['migrate'] = (data) => {
  const existingRagOptions =
    typeof data.ragOptions === 'object' && data.ragOptions !== null
      ? (data.ragOptions as Record<string, unknown>)
      : {}

  return {
    ...data,
    version: 17,
    providers: getMigratedProviders(data, DEFAULT_PROVIDERS_V16),
    chatModels: mergePlanModelCatalog(data.chatModels),
    chatModelId: migratePlanModelId(data.chatModelId),
    applyModelId: migratePlanModelId(data.applyModelId),
    inlineEdit: {
      modelId: null,
      contextCharacters: 4000,
    },
    imageGeneration: {
      modelId: DEFAULT_IMAGE_MODEL_ID,
      outputFolder: 'Smart Composer/Generated Images',
      quality: 'high',
      concurrency: 1,
    },
    ragOptions: {
      ...existingRagOptions,
      retrievalMode: existingRagOptions.retrievalMode ?? 'auto',
      folderReadMode: existingRagOptions.folderReadMode ?? 'auto',
      exhaustiveDirectTokenLimit:
        existingRagOptions.exhaustiveDirectTokenLimit ?? 60000,
      planRerankCandidateLimit:
        existingRagOptions.planRerankCandidateLimit ?? 40,
    },
  }
}
