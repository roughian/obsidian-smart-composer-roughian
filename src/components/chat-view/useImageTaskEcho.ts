import { Dispatch, SetStateAction, useEffect, useRef } from 'react'

import { usePlugin } from '../../contexts/plugin-context'
import {
  ArtifactRecord,
  BackgroundTaskRecord,
} from '../../types/background-task'
import { ChatAssistantMessage, ChatMessage } from '../../types/chat'
import {
  buildImageEchoMessage,
  buildImageProgressMessage,
  hasEchoableArtifact,
  isImageTaskInProgress,
  selectConversationImageTasks,
  upsertChatMessage,
} from '../../utils/chat/image-echo'

/**
 * Mirrors image tasks of the current conversation into the chat: a progress
 * placeholder is appended as soon as a task is queued and replaced in place by
 * the `![[image]]` block once the artifact exists.
 */
export function useImageTaskEcho({
  conversationId,
  setChatMessages,
  onChange,
}: {
  conversationId: string
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>
  /** Called after the chat changed; `final` marks the finished image. */
  onChange: (options: { final: boolean }) => void
}) {
  const plugin = usePlugin()
  const artifactCache = useRef(
    new Map<string, Promise<ArtifactRecord | null>>(),
  )

  useEffect(() => {
    const manager = plugin.backgroundTaskManager
    if (!manager) return

    const upsert = (
      message: ChatAssistantMessage,
      appendIfMissing: boolean,
      final = false,
    ) =>
      setChatMessages((previous) => {
        const next = upsertChatMessage({
          messages: previous,
          message,
          appendIfMissing,
        })
        if (next !== previous) requestAnimationFrame(() => onChange({ final }))
        return next
      })

    const readArtifact = (id: string) => {
      const cached = artifactCache.current.get(id)
      if (cached) return cached
      const pending = manager.readArtifact(id)
      artifactCache.current.set(id, pending)
      return pending
    }

    const echoTask = (task: BackgroundTaskRecord) => {
      if (hasEchoableArtifact(task)) {
        void readArtifact(task.artifactIds[0]).then((artifact) => {
          if (artifact) {
            upsert(buildImageEchoMessage({ task, artifact }), true, true)
          }
        })
        return
      }
      const message = buildImageProgressMessage(task)
      if (message) upsert(message, isImageTaskInProgress(task))
    }

    return manager.subscribe((tasks) => {
      selectConversationImageTasks({ tasks, conversationId }).forEach(echoTask)
    })
  }, [conversationId, plugin.backgroundTaskManager, setChatMessages, onChange])
}
