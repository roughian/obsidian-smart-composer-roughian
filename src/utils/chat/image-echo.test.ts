import {
  ArtifactRecord,
  BackgroundTaskRecord,
} from '../../types/background-task'

import {
  IMAGE_ECHO_MESSAGE_PREFIX,
  buildImageEchoMessage,
  buildImageEmbedMarkdown,
  buildImageProgressMessage,
  isImageEchoBlock,
  resolveArtifactMarkdown,
  selectConversationImageTasks,
  upsertChatMessage,
} from './image-echo'

function task(
  overrides: Partial<BackgroundTaskRecord> = {},
): BackgroundTaskRecord {
  return {
    schemaVersion: 1,
    id: 'task-1',
    conversationId: 'conv-1',
    originMessageId: 'msg-1',
    kind: 'image-generation',
    status: 'awaiting-destination',
    attempt: 1,
    createdAt: 1,
    updatedAt: 1,
    input: { prompt: 'a red circle', displayPrompt: '1/2 · a red circle' },
    artifactIds: ['artifact-1'],
    ...overrides,
  }
}

const artifact: ArtifactRecord = {
  schemaVersion: 1,
  id: 'artifact-1',
  taskId: 'task-1',
  kind: 'image',
  createdAt: 1,
  localPath: 'Generated/1-a-red-circle.png',
}

describe('buildImageEchoMessage', () => {
  it('wraps the embed in an apply block with the display prompt under a deterministic id', () => {
    expect(buildImageEchoMessage({ task: task(), artifact })).toEqual({
      role: 'assistant',
      id: `${IMAGE_ECHO_MESSAGE_PREFIX}task-1`,
      content:
        '1/2 · a red circle\n\n<smtcmp_block language="markdown">![[Generated/1-a-red-circle.png]]</smtcmp_block>',
    })
  })

  it('warns when the image had to stay in the vault', () => {
    expect(
      buildImageEchoMessage({
        task: task(),
        artifact: {
          ...artifact,
          metadata: { destinationError: 'Eagle is not running' },
        },
      }).content,
    ).toBe(
      '1/2 · a red circle\n\n> [!warning] Kept in the vault folder\n> Eagle is not running\n\n<smtcmp_block language="markdown">![[Generated/1-a-red-circle.png]]</smtcmp_block>',
    )
  })

  it('falls back to the raw prompt and skips the embed without a path', () => {
    expect(
      buildImageEchoMessage({
        task: task({ input: { prompt: 'plain' } }),
        artifact: { ...artifact, localPath: undefined },
      }).content,
    ).toBe('plain')
  })
})

describe('buildImageEmbedMarkdown', () => {
  it('wraps the vault path in an Obsidian embed', () => {
    expect(buildImageEmbedMarkdown('a/b.png')).toBe('![[a/b.png]]')
  })
})

describe('isImageEchoBlock', () => {
  const echo = buildImageEchoMessage({ task: task(), artifact })
  const plain = { role: 'assistant' as const, id: 'a1', content: '![[x.png]]' }

  it('recognises a block rendered from an image echo message', () => {
    expect(
      isImageEchoBlock({
        messages: [plain, echo],
        block: '![[Generated/1-a-red-circle.png]]',
      }),
    ).toBe(true)
  })

  it('ignores blocks that only appear in ordinary assistant messages', () => {
    expect(isImageEchoBlock({ messages: [plain], block: '![[x.png]]' })).toBe(
      false,
    )
  })
})

describe('resolveArtifactMarkdown', () => {
  it('prefers the delivered markdown stored on the artifact', () => {
    expect(
      resolveArtifactMarkdown({
        ...artifact,
        localPath: undefined,
        metadata: { markdown: '[![c](file:///lib/c.png)](eagle://item/ID1)' },
      }),
    ).toBe('[![c](file:///lib/c.png)](eagle://item/ID1)')
  })

  it('falls back to a vault embed and then to null', () => {
    expect(resolveArtifactMarkdown(artifact)).toBe(
      '![[Generated/1-a-red-circle.png]]',
    )
    expect(
      resolveArtifactMarkdown({ ...artifact, localPath: undefined }),
    ).toBeNull()
  })
})

describe('buildImageProgressMessage', () => {
  it('shows a queued callout under the echo id', () => {
    expect(buildImageProgressMessage(task({ status: 'queued' }))).toEqual({
      role: 'assistant',
      id: `${IMAGE_ECHO_MESSAGE_PREFIX}task-1`,
      content: '> [!smtcmp-image-progress] Image queued\n> 1/2 · a red circle',
    })
  })

  it('reflects the latest progress message while running', () => {
    expect(
      buildImageProgressMessage(
        task({
          status: 'running',
          progress: { phase: 'receiving', message: 'Receiving image preview' },
        }),
      )?.content,
    ).toBe(
      '> [!smtcmp-image-progress] Receiving image preview…\n> 1/2 · a red circle',
    )
  })

  it('falls back to a generic running label without progress', () => {
    expect(
      buildImageProgressMessage(task({ status: 'running' }))?.content,
    ).toContain('Generating image…')
  })

  it('reports failures with the task error', () => {
    expect(
      buildImageProgressMessage(task({ status: 'failed', error: 'boom' }))
        ?.content,
    ).toBe(
      '> [!failure] Image generation failed\n> boom\n> 1/2 · a red circle\n> Retry from the Image queue panel below.',
    )
  })

  it('returns null once an artifact-bearing status is reached', () => {
    expect(buildImageProgressMessage(task())).toBeNull()
    expect(buildImageProgressMessage(task({ status: 'succeeded' }))).toBeNull()
  })
})

describe('upsertChatMessage', () => {
  const user = {
    role: 'user' as const,
    id: 'u1',
    content: null,
    promptContent: null,
    mentionables: [],
  }
  const echo = buildImageEchoMessage({ task: task(), artifact })
  const progress = {
    role: 'assistant' as const,
    id: echo.id,
    content: '> [!smtcmp-image-progress] Image queued',
  }

  it('appends when missing and allowed', () => {
    expect(
      upsertChatMessage({
        messages: [user],
        message: echo,
        appendIfMissing: true,
      }),
    ).toEqual([user, echo])
  })

  it('leaves the array untouched when missing and not allowed', () => {
    const messages = [user]
    expect(
      upsertChatMessage({ messages, message: echo, appendIfMissing: false }),
    ).toBe(messages)
  })

  it('replaces the placeholder in place instead of appending', () => {
    const later = { ...user, id: 'u2' }
    expect(
      upsertChatMessage({
        messages: [user, progress, later],
        message: echo,
        appendIfMissing: false,
      }),
    ).toEqual([user, echo, later])
  })

  it('returns the same reference when the content is unchanged', () => {
    const messages = [user, echo]
    expect(
      upsertChatMessage({ messages, message: echo, appendIfMissing: true }),
    ).toBe(messages)
  })
})

describe('selectConversationImageTasks', () => {
  it('keeps image tasks of the conversation regardless of status', () => {
    const tasks = [
      task({ id: 'ready' }),
      task({ id: 'running', status: 'running' }),
      task({ id: 'other', conversationId: 'conv-2' }),
    ]

    expect(
      selectConversationImageTasks({ tasks, conversationId: 'conv-1' }).map(
        (item) => item.id,
      ),
    ).toEqual(['ready', 'running'])
  })
})
