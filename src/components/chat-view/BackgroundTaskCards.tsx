import {
  Check,
  CircleEllipsis,
  Expand,
  FolderOpen,
  LoaderCircle,
  LocateFixed,
  RotateCcw,
  Square,
  X,
} from 'lucide-react'
import { Notice, TFile } from 'obsidian'
import { useEffect, useState } from 'react'

import { useApp } from '../../contexts/app-context'
import { usePlugin } from '../../contexts/plugin-context'
import { openImageApplyView } from '../../core/image/image-apply'
import {
  RESOLVED_IMAGE_DESTINATION_LABELS,
  isResolvedImageDestination,
} from '../../core/image/image-destination'
import {
  ArtifactRecord,
  BackgroundTaskRecord,
} from '../../types/background-task'
import { resolveArtifactMarkdown } from '../../utils/chat/image-echo'
import { selectVisibleImageTasks } from '../../utils/chat/imageQueue'

export function BackgroundTaskCards({
  conversationId,
  onLocateOrigin,
}: {
  conversationId: string
  onLocateOrigin?: (messageId: string) => void
}) {
  const app = useApp()
  const plugin = usePlugin()
  const manager = plugin.backgroundTaskManager
  const [tasks, setTasks] = useState<BackgroundTaskRecord[]>([])
  const [artifacts, setArtifacts] = useState<Record<string, ArtifactRecord>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!manager) return
    return manager.subscribe((allTasks) => {
      const relevant = selectVisibleImageTasks(allTasks, conversationId)
      setTasks(relevant)
      void Promise.all(
        relevant
          .flatMap((task) => task.artifactIds)
          .map((id) => manager.readArtifact(id)),
      ).then((records) => {
        setArtifacts(
          Object.fromEntries(
            records
              .filter((record): record is ArtifactRecord => !!record)
              .map((record) => [record.id, record]),
          ),
        )
      })
    })
  }, [conversationId, manager])

  if (!manager || tasks.length === 0) return null

  const finishLocal = async (
    task: BackgroundTaskRecord,
    artifact: ArtifactRecord,
    embed: boolean,
  ) => {
    const markdown = resolveArtifactMarkdown(artifact)
    if (embed && markdown) {
      const preferredFilePath =
        typeof task.input.targetFilePath === 'string'
          ? task.input.targetFilePath
          : undefined
      const opened = await openImageApplyView({
        app,
        markdown,
        preferredFilePath,
      })
      if (!opened) {
        new Notice('Open a Markdown note before inserting the image.')
        return
      }
    }
    await manager.complete(task.id, {
      progress: {
        phase: embed ? 'inserted' : 'saved',
        message: embed ? 'Opened in Apply view' : 'Saved',
      },
    })
  }

  return (
    <div className="smtcmp-task-list" aria-live="polite">
      {tasks.map((task) => {
        const artifact = artifacts[task.artifactIds[0]]
        const file = artifact?.localPath
          ? app.vault.getAbstractFileByPath(artifact.localPath)
          : null
        const resourcePath =
          file instanceof TFile ? app.vault.getResourcePath(file) : null
        const statusMessage =
          task.progress?.message ?? task.error ?? task.status.replace(/-/g, ' ')
        const destination = artifact?.metadata?.destination
        const destinationLabel =
          isResolvedImageDestination(destination) && destination !== 'vault'
            ? RESOLVED_IMAGE_DESTINATION_LABELS[destination]
            : null
        const referenceCount = Array.isArray(task.input.referenceImagePaths)
          ? task.input.referenceImagePaths.length
          : 0
        const displayPrompt =
          typeof task.input.displayPrompt === 'string'
            ? task.input.displayPrompt
            : typeof task.input.prompt === 'string'
              ? task.input.prompt
              : null
        return (
          <section
            className="smtcmp-task-card"
            data-task-kind={task.kind}
            data-task-status={task.status}
            key={task.id}
          >
            <div className="smtcmp-task-card__status">
              {['queued', 'running'].includes(task.status) ? (
                <LoaderCircle className="smtcmp-task-spinner" size={16} />
              ) : task.status === 'succeeded' ? (
                <Check size={16} />
              ) : ['awaiting-destination', 'awaiting-approval'].includes(
                  task.status,
                ) ? (
                <CircleEllipsis size={15} />
              ) : task.status === 'canceled' ? (
                <Square size={14} />
              ) : (
                <X size={16} />
              )}
              <span>{statusMessage}</span>
              {task.conversationId === conversationId && onLocateOrigin && (
                <button
                  className="smtcmp-task-card__locate"
                  onClick={() => onLocateOrigin(task.originMessageId)}
                  aria-label="Go to image request"
                >
                  <LocateFixed size={13} />
                </button>
              )}
              {task.status === 'succeeded' && (
                <button
                  className="smtcmp-task-card__dismiss"
                  onClick={() => void manager.dismiss(task.id)}
                  aria-label="Dismiss completed image task"
                  title="Dismiss completed image task"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {displayPrompt && (
              <div className="smtcmp-task-card__prompt" title={displayPrompt}>
                {displayPrompt}
              </div>
            )}
            {destinationLabel && (
              <div className="smtcmp-task-card__hint">
                Stored in {destinationLabel}
              </div>
            )}
            {referenceCount > 0 && (
              <div className="smtcmp-task-card__hint">
                {referenceCount} reference image{referenceCount > 1 ? 's' : ''}
              </div>
            )}
            {resourcePath && (
              <button
                className="smtcmp-image-preview"
                onClick={() => setExpanded(resourcePath)}
                aria-label="Open generated image full size"
              >
                <img src={resourcePath} alt="Generated image preview" />
                <Expand size={16} />
                {artifact?.width && artifact.height && (
                  <span>
                    {artifact.width} × {artifact.height}
                  </span>
                )}
              </button>
            )}
            {artifact?.localPath && (
              <div className="smtcmp-task-card__location">
                <span title={artifact.localPath}>
                  Vault: {artifact.localPath}
                </span>
                {file instanceof TFile && (
                  <button
                    aria-label="Open generated image file"
                    onClick={() =>
                      void app.workspace.getLeaf('tab').openFile(file)
                    }
                  >
                    <FolderOpen size={13} />
                  </button>
                )}
              </div>
            )}
            {task.status === 'awaiting-destination' && artifact && (
              <div className="smtcmp-task-card__actions">
                <button onClick={() => void finishLocal(task, artifact, false)}>
                  <Check size={14} />{' '}
                  {artifact.localPath ? 'Keep in folder' : 'Keep'}
                </button>
                <button onClick={() => void finishLocal(task, artifact, true)}>
                  <Check size={14} /> Insert embed
                </button>
              </div>
            )}
            {['failed', 'interrupted', 'canceled'].includes(task.status) && (
              <button onClick={() => void manager.retry(task.id)}>
                <RotateCcw size={14} /> Retry
              </button>
            )}
            {['queued', 'running'].includes(task.status) && (
              <button onClick={() => void manager.cancel(task.id)}>
                <Square size={14} /> Cancel task
              </button>
            )}
          </section>
        )
      })}
      {expanded && (
        <div
          className="smtcmp-image-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setExpanded(null)}
        >
          <button aria-label="Close full-size image">
            <X />
          </button>
          <img src={expanded} alt="Generated image full size" />
        </div>
      )}
    </div>
  )
}
