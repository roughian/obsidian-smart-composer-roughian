import {
  ArtifactRecord,
  BackgroundTaskRecord,
} from '../../types/background-task'
import { ChatAssistantMessage, ChatMessage } from '../../types/chat'

export const IMAGE_ECHO_MESSAGE_PREFIX = 'image-echo:'

const ECHOABLE_STATUSES = new Set<BackgroundTaskRecord['status']>([
  'awaiting-destination',
  'succeeded',
])

const IN_PROGRESS_STATUSES = new Set<BackgroundTaskRecord['status']>([
  'queued',
  'running',
  'awaiting-approval',
])

const DEFAULT_RUNNING_MESSAGE = 'Generating image'
/** Custom callout type styled with a spinning icon in styles.css. */
const PROGRESS_CALLOUT = 'smtcmp-image-progress'

export function buildImageEmbedMarkdown(localPath: string): string {
  return `![[${localPath}]]`
}

/** Markdown referencing the artifact where it lives now (Eagle/cloud/vault). */
export function resolveArtifactMarkdown(
  artifact: ArtifactRecord,
): string | null {
  const stored = artifact.metadata?.markdown
  if (typeof stored === 'string' && stored) return stored
  return artifact.localPath ? buildImageEmbedMarkdown(artifact.localPath) : null
}

/** True when an Apply block was rendered from an image echo message. */
export function isImageEchoBlock({
  messages,
  block,
}: {
  messages: ChatMessage[]
  block: string
}): boolean {
  const needle = block.trim()
  return messages.some(
    (message) =>
      message.role === 'assistant' &&
      message.id.startsWith(IMAGE_ECHO_MESSAGE_PREFIX) &&
      message.content.includes(needle),
  )
}

export function isImageTaskInProgress(task: BackgroundTaskRecord): boolean {
  return IN_PROGRESS_STATUSES.has(task.status)
}

export function hasEchoableArtifact(task: BackgroundTaskRecord): boolean {
  return ECHOABLE_STATUSES.has(task.status) && task.artifactIds.length > 0
}

function getDisplayPrompt(task: BackgroundTaskRecord): string {
  if (typeof task.input.displayPrompt === 'string') {
    return task.input.displayPrompt
  }
  return typeof task.input.prompt === 'string' ? task.input.prompt : ''
}

function buildCallout(kind: string, title: string, lines: string[]): string {
  return [
    `> [!${kind}] ${title}`,
    ...lines.filter(Boolean).map((l) => `> ${l}`),
  ].join('\n')
}

/** Deterministic id so the same task never echoes twice into a conversation. */
export function buildImageEchoMessage({
  task,
  artifact,
}: {
  task: BackgroundTaskRecord
  artifact: ArtifactRecord
}): ChatAssistantMessage {
  const prompt = getDisplayPrompt(task)
  const markdown = resolveArtifactMarkdown(artifact)
  const embed = markdown
    ? `<smtcmp_block language="markdown">${markdown}</smtcmp_block>`
    : ''
  const error = artifact.metadata?.destinationError
  const warning =
    typeof error === 'string' && error
      ? buildCallout('warning', 'Kept in the vault folder', [error])
      : ''
  return {
    role: 'assistant',
    id: `${IMAGE_ECHO_MESSAGE_PREFIX}${task.id}`,
    content: [prompt, warning, embed].filter(Boolean).join('\n\n'),
  }
}

/**
 * Placeholder shown in the chat while a task is queued/running, or after it
 * failed. Shares the echo id so the finished image replaces it in place.
 */
export function buildImageProgressMessage(
  task: BackgroundTaskRecord,
): ChatAssistantMessage | null {
  const prompt = getDisplayPrompt(task)
  let content: string
  if (task.status === 'queued') {
    content = buildCallout(PROGRESS_CALLOUT, 'Image queued', [prompt])
  } else if (isImageTaskInProgress(task)) {
    const message = task.progress?.message ?? DEFAULT_RUNNING_MESSAGE
    content = buildCallout(PROGRESS_CALLOUT, `${message}…`, [prompt])
  } else if (task.status === 'canceled') {
    content = buildCallout('warning', 'Image generation canceled', [prompt])
  } else if (task.status === 'failed' || task.status === 'interrupted') {
    content = buildCallout('failure', 'Image generation failed', [
      task.error ?? '',
      prompt,
      'Retry from the Image queue panel below.',
    ])
  } else {
    return null
  }
  return {
    role: 'assistant',
    id: `${IMAGE_ECHO_MESSAGE_PREFIX}${task.id}`,
    content,
  }
}

/**
 * Replaces the message with the same id in place, appends it when absent and
 * `appendIfMissing` is set, and returns the original array when nothing changes.
 */
export function upsertChatMessage({
  messages,
  message,
  appendIfMissing,
}: {
  messages: ChatMessage[]
  message: ChatAssistantMessage
  appendIfMissing: boolean
}): ChatMessage[] {
  const index = messages.findIndex((existing) => existing.id === message.id)
  if (index === -1) {
    return appendIfMissing ? [...messages, message] : messages
  }
  const existing = messages[index]
  if (existing.role === 'assistant' && existing.content === message.content) {
    return messages
  }
  return messages.map((item, position) => (position === index ? message : item))
}

export function selectConversationImageTasks({
  tasks,
  conversationId,
}: {
  tasks: BackgroundTaskRecord[]
  conversationId: string
}): BackgroundTaskRecord[] {
  return tasks.filter(
    (task) =>
      task.kind === 'image-generation' &&
      task.conversationId === conversationId,
  )
}
