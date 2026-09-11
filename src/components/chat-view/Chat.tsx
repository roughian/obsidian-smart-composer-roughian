import { useMutation } from '@tanstack/react-query'
import { Book, CircleStop, History, Plus } from 'lucide-react'
import { App, Notice } from 'obsidian'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { v4 as uuidv4 } from 'uuid'

import { ApplyViewState } from '../../ApplyView'
import { APPLY_VIEW_TYPE } from '../../constants'
import { useApp } from '../../contexts/app-context'
import { useMcp } from '../../contexts/mcp-context'
import { usePlugin } from '../../contexts/plugin-context'
import { useRAG } from '../../contexts/rag-context'
import { useSettings } from '../../contexts/settings-context'
import { QueuedPrompt } from '../../core/conversation/ConversationRunManager'
import {
  getEagleBridge,
  getEaglePasteBehavior,
} from '../../core/image/eagle-bridge'
import { openImageApplyView } from '../../core/image/image-apply'
import { destinationFromPasteBehavior } from '../../core/image/image-destination'
import { storeReferenceImages } from '../../core/image/reference-image-store'
import { resolveImageGenerationModel } from '../../core/image/resolve-image-model'
import {
  LLMAPIKeyInvalidException,
  LLMAPIKeyNotSetException,
  LLMBaseUrlNotSetException,
} from '../../core/llm/exception'
import { getChatModelClient } from '../../core/llm/manager'
import { useChatHistory } from '../../hooks/useChatHistory'
import {
  AssistantToolMessageGroup,
  ChatMessage,
  ChatToolMessage,
  ChatUserMessage,
} from '../../types/chat'
import {
  MentionableBlock,
  MentionableBlockData,
  MentionableCurrentFile,
  MentionableImage,
} from '../../types/mentionable'
import { ToolCallResponseStatus } from '../../types/tool-call.types'
import { applyChangesToFile } from '../../utils/chat/apply'
import { isImageEchoBlock } from '../../utils/chat/image-echo'
import { enqueueImageGenerationBatch } from '../../utils/chat/imageBatch'
import {
  MAX_IMAGE_BATCH_COUNT,
  getImageGenerationPrompt,
  isImageGenerationContinuation,
  parseImageGenerationRequest,
} from '../../utils/chat/imageIntent'
import {
  getMentionableKey,
  serializeMentionable,
} from '../../utils/chat/mentionable'
import { groupAssistantAndToolMessages } from '../../utils/chat/message-groups'
import { PromptGenerator } from '../../utils/chat/promptGenerator'
import { readTFileContent } from '../../utils/obsidian'
import { ErrorModal } from '../modals/ErrorModal'
import { ImageDestinationModal } from '../modals/ImageDestinationModal'
import { TemplateSectionModal } from '../modals/TemplateSectionModal'

import AssistantToolMessageGroupItem from './AssistantToolMessageGroupItem'
import ChatUserInput, { ChatUserInputRef } from './chat-input/ChatUserInput'
import { editorStateToPlainText } from './chat-input/utils/editor-state-to-plain-text'
import { ChatListDropdown } from './ChatListDropdown'
import { ImageQueuePanel } from './ImageQueuePanel'
import QueryProgress, { QueryProgressState } from './QueryProgress'
import { QueuedPrompts } from './QueuedPrompts'
import { ResponsePendingIndicator } from './ResponsePendingIndicator'
import { useAutoScroll } from './useAutoScroll'
import { useChatStreamManager } from './useChatStreamManager'
import { useImageTaskEcho } from './useImageTaskEcho'
import UserMessageItem from './UserMessageItem'

// Add an empty line here
const getNewInputMessage = (app: App): ChatUserMessage => {
  return {
    role: 'user',
    content: null,
    promptContent: null,
    id: uuidv4(),
    mentionables: [
      {
        type: 'current-file',
        file: app.workspace.getActiveFile(),
      },
    ],
  }
}

export type ChatRef = {
  openNewChat: (selectedBlock?: MentionableBlockData) => void
  addSelectionToChat: (selectedBlock: MentionableBlockData) => void
  focusMessage: () => void
}

export type ChatProps = {
  selectedBlock?: MentionableBlockData
}

const Chat = forwardRef<ChatRef, ChatProps>((props, ref) => {
  const app = useApp()
  const plugin = usePlugin()
  const { settings, setSettings } = useSettings()
  const { getRAGEngine } = useRAG()
  const { getMcpManager } = useMcp()

  const {
    createOrUpdateConversation,
    deleteConversation,
    getChatMessagesById,
    updateConversationTitle,
    chatList,
  } = useChatHistory()
  const promptGenerator = useMemo(() => {
    return new PromptGenerator(getRAGEngine, app, settings, setSettings)
  }, [getRAGEngine, app, settings, setSettings])

  const [inputMessage, setInputMessage] = useState<ChatUserMessage>(() => {
    const newMessage = getNewInputMessage(app)
    if (props.selectedBlock) {
      newMessage.mentionables = [
        ...newMessage.mentionables,
        {
          type: 'block',
          ...props.selectedBlock,
        },
      ]
    }
    return newMessage
  })
  const [addedBlockKey, setAddedBlockKey] = useState<string | null>(
    props.selectedBlock
      ? getMentionableKey(
          serializeMentionable({
            type: 'block',
            ...props.selectedBlock,
          }),
        )
      : null,
  )
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null)
  const [currentConversationId, setCurrentConversationId] =
    useState<string>(uuidv4())
  const [queryProgress, setQueryProgress] = useState<QueryProgressState>({
    type: 'idle',
  })
  const [queuedPrompts, setQueuedPrompts] = useState<QueuedPrompt[]>([])

  const groupedChatMessages: (ChatUserMessage | AssistantToolMessageGroup)[] =
    useMemo(() => {
      return groupAssistantAndToolMessages(chatMessages)
    }, [chatMessages])

  const chatUserInputRefs = useRef<Map<string, ChatUserInputRef>>(new Map())
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const queueDispatchingRef = useRef(false)

  const { autoScrollToBottom, forceScrollToBottom } = useAutoScroll({
    scrollContainerRef: chatMessagesRef,
  })

  const { abortActiveStreams, responsePhase, submitChatMutation } =
    useChatStreamManager({
      setChatMessages,
      autoScrollToBottom,
      promptGenerator,
    })

  const locateMessage = useCallback((messageId: string) => {
    const container = chatMessagesRef.current
    if (!container) return
    const element = Array.from(
      container.querySelectorAll<HTMLElement>('[data-message-id]'),
    ).find((candidate) => candidate.dataset.messageId === messageId)
    if (!element) return
    const reducedMotion =
      element.ownerDocument.defaultView?.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches ?? false
    element.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    })
    element.classList.add('smtcmp-message-anchor--highlighted')
    element.ownerDocument.defaultView?.setTimeout(() => {
      element.classList.remove('smtcmp-message-anchor--highlighted')
    }, 1400)
  }, [])

  useEffect(() => {
    const manager = plugin.conversationRunManager
    if (!manager) return
    setQueuedPrompts(manager.getQueue(currentConversationId))
    return manager.subscribe((conversationId, queue) => {
      if (conversationId === currentConversationId) setQueuedPrompts(queue)
    })
  }, [currentConversationId, plugin.conversationRunManager])

  useEffect(() => {
    void plugin.conversationRunManager?.hydrate(currentConversationId)
  }, [currentConversationId, plugin.conversationRunManager])

  const handleImageEchoChange = useCallback(
    ({ final }: { final: boolean }) => {
      // A finished image should always come into view; progress ticks only
      // follow the user when they are already near the bottom.
      if (final) forceScrollToBottom()
      else autoScrollToBottom()
    },
    [forceScrollToBottom, autoScrollToBottom],
  )

  useImageTaskEcho({
    conversationId: currentConversationId,
    setChatMessages,
    onChange: handleImageEchoChange,
  })

  // Images load after the message renders and push content down; keep the
  // bottom in view once they arrive (load does not bubble, so capture it).
  useEffect(() => {
    const container = chatMessagesRef.current
    if (!container) return
    const handleImageLoad = (event: Event) => {
      if (event.target instanceof HTMLImageElement) autoScrollToBottom()
    }
    container.addEventListener('load', handleImageLoad, true)
    return () => container.removeEventListener('load', handleImageLoad, true)
  }, [autoScrollToBottom])

  const registerChatUserInputRef = (
    id: string,
    ref: ChatUserInputRef | null,
  ) => {
    if (ref) {
      chatUserInputRefs.current.set(id, ref)
    } else {
      chatUserInputRefs.current.delete(id)
    }
  }

  const handleLoadConversation = async (conversationId: string) => {
    try {
      abortActiveStreams()
      const conversation = await getChatMessagesById(conversationId)
      if (!conversation) {
        throw new Error('Conversation not found')
      }
      setCurrentConversationId(conversationId)
      setChatMessages(conversation)
      const newInputMessage = getNewInputMessage(app)
      setInputMessage(newInputMessage)
      setFocusedMessageId(newInputMessage.id)
      setQueryProgress({
        type: 'idle',
      })
    } catch (error) {
      new Notice('Failed to load conversation')
      console.error('Failed to load conversation', error)
    }
  }

  const handleNewChat = (selectedBlock?: MentionableBlockData) => {
    setCurrentConversationId(uuidv4())
    setChatMessages([])
    const newInputMessage = getNewInputMessage(app)
    if (selectedBlock) {
      const mentionableBlock: MentionableBlock = {
        type: 'block',
        ...selectedBlock,
      }
      newInputMessage.mentionables = [
        ...newInputMessage.mentionables,
        mentionableBlock,
      ]
      setAddedBlockKey(
        getMentionableKey(serializeMentionable(mentionableBlock)),
      )
    }
    setInputMessage(newInputMessage)
    setFocusedMessageId(newInputMessage.id)
    setQueryProgress({
      type: 'idle',
    })
    abortActiveStreams()
  }

  const handleUserMessageSubmit = useCallback(
    async ({
      inputChatMessages,
      useVaultSearch,
    }: {
      inputChatMessages: ChatMessage[]
      useVaultSearch?: boolean
    }) => {
      abortActiveStreams()
      setQueryProgress({
        type: 'idle',
      })

      // Update the chat history to show the new user message
      setChatMessages(inputChatMessages)
      requestAnimationFrame(() => {
        forceScrollToBottom()
      })

      const lastMessage = inputChatMessages.at(-1)
      if (lastMessage?.role !== 'user') {
        throw new Error('Last message is not a user message')
      }

      const compiledMessages = await Promise.all(
        inputChatMessages.map(async (message) => {
          if (message.role === 'user' && message.id === lastMessage.id) {
            const {
              promptContent,
              similaritySearchResults,
              retrievalMetadata,
            } = await promptGenerator.compileUserMessagePrompt({
              message,
              useVaultSearch,
              onQueryProgressChange: setQueryProgress,
            })
            return {
              ...message,
              promptContent,
              similaritySearchResults,
              retrievalMetadata,
            }
          } else if (message.role === 'user' && !message.promptContent) {
            // Ensure all user messages have prompt content
            // This is a fallback for cases where compilation was missed earlier in the process
            const {
              promptContent,
              similaritySearchResults,
              retrievalMetadata,
            } = await promptGenerator.compileUserMessagePrompt({
              message,
            })
            return {
              ...message,
              promptContent,
              similaritySearchResults,
              retrievalMetadata,
            }
          }
          return message
        }),
      )

      setChatMessages(compiledMessages)
      submitChatMutation.mutate({
        chatMessages: compiledMessages,
        conversationId: currentConversationId,
      })
    },
    [
      submitChatMutation,
      currentConversationId,
      promptGenerator,
      abortActiveStreams,
      forceScrollToBottom,
    ],
  )

  const applyMutation = useMutation({
    mutationFn: async ({
      blockToApply,
      contextMessages,
    }: {
      blockToApply: string
      contextMessages: ChatMessage[]
    }) => {
      if (
        isImageEchoBlock({ messages: contextMessages, block: blockToApply })
      ) {
        const opened = await openImageApplyView({
          app,
          markdown: blockToApply.trim(),
        })
        if (!opened) {
          throw new Error(
            'No file is currently open to insert the image. Please open a note and try again.',
          )
        }
        return
      }
      const activeFile = app.workspace.getActiveFile()
      if (!activeFile) {
        throw new Error(
          'No file is currently open to apply changes. Please open a file and try again.',
        )
      }
      const activeFileContent = await readTFileContent(activeFile, app.vault)
      const { providerClient, model } = getChatModelClient({
        modelId: settings.applyModelId,
        settings,
        setSettings,
      })
      const updatedFileContent = await applyChangesToFile({
        blockToApply,
        currentFile: activeFile,
        currentFileContent: activeFileContent,
        chatMessages: contextMessages,
        providerClient,
        model,
      })
      if (!updatedFileContent) throw new Error('Failed to apply changes')

      await app.workspace.getLeaf(true).setViewState({
        type: APPLY_VIEW_TYPE,
        active: true,
        state: {
          file: activeFile,
          originalContent: activeFileContent,
          newContent: updatedFileContent,
        } satisfies ApplyViewState,
      })
    },
    onError: (error: Error) => {
      if (
        error instanceof LLMAPIKeyNotSetException ||
        error instanceof LLMAPIKeyInvalidException ||
        error instanceof LLMBaseUrlNotSetException
      ) {
        new ErrorModal(app, 'Error', error.message, error.rawError?.message, {
          showSettingsButton: true,
        }).open()
        return
      }
      new Notice(error.message)
      console.error('Failed to apply changes', error)
    },
  })

  const handleApply = useCallback(
    (blockToApply: string, contextMessages: ChatMessage[]) => {
      applyMutation.mutate({ blockToApply, contextMessages })
    },
    [applyMutation],
  )

  useEffect(() => {
    if (
      submitChatMutation.isPending ||
      submitChatMutation.isError ||
      queuedPrompts.length === 0 ||
      queueDispatchingRef.current
    ) {
      return
    }
    queueDispatchingRef.current = true
    void plugin.conversationRunManager
      ?.shift(currentConversationId)
      .then(async (next) => {
        if (!next) return
        await handleUserMessageSubmit({
          inputChatMessages: [...chatMessages, next.message],
          useVaultSearch: next.useVaultSearch,
        })
      })
      .finally(() => {
        queueDispatchingRef.current = false
      })
  }, [
    chatMessages,
    currentConversationId,
    handleUserMessageSubmit,
    plugin.conversationRunManager,
    queuedPrompts.length,
    submitChatMutation.isPending,
    submitChatMutation.isError,
  ])

  const handleToolMessageUpdate = useCallback(
    async (toolMessage: ChatToolMessage) => {
      const toolMessageIndex = chatMessages.findIndex(
        (message) => message.id === toolMessage.id,
      )
      if (toolMessageIndex === -1) {
        // The tool message no longer exists in the chat history.
        // This likely means a new message was submitted while this stream was running.
        // Abort the tool calls and keep the current chat history.
        void (async () => {
          const mcpManager = await getMcpManager()
          toolMessage.toolCalls.forEach((toolCall) => {
            mcpManager.abortToolCall(toolCall.request.id)
          })
        })()
        return
      }

      const updatedMessages = chatMessages.map((message) =>
        message.id === toolMessage.id ? toolMessage : message,
      )
      setChatMessages(updatedMessages)

      // Resume the chat automatically if this tool message is the last message
      // and all tool calls have completed.
      if (
        toolMessageIndex === chatMessages.length - 1 &&
        toolMessage.toolCalls.every((toolCall) =>
          [
            ToolCallResponseStatus.Success,
            ToolCallResponseStatus.Error,
          ].includes(toolCall.response.status),
        )
      ) {
        // Using updated toolMessage directly because chatMessages state
        // still contains the old values
        submitChatMutation.mutate({
          chatMessages: updatedMessages,
          conversationId: currentConversationId,
        })
        requestAnimationFrame(() => {
          forceScrollToBottom()
        })
      }
    },
    [
      chatMessages,
      currentConversationId,
      submitChatMutation,
      setChatMessages,
      getMcpManager,
      forceScrollToBottom,
    ],
  )

  const showContinueResponseButton = useMemo(() => {
    /**
     * Display the button to continue response when:
     * 1. There is no ongoing generation
     * 2. The most recent message is a tool message
     * 3. All tool calls within that message have completed
     */

    if (submitChatMutation.isPending) return false

    const lastMessage = chatMessages.at(-1)
    if (lastMessage?.role !== 'tool') return false

    return lastMessage.toolCalls.every((toolCall) =>
      [
        ToolCallResponseStatus.Aborted,
        ToolCallResponseStatus.Rejected,
        ToolCallResponseStatus.Error,
        ToolCallResponseStatus.Success,
      ].includes(toolCall.response.status),
    )
  }, [submitChatMutation.isPending, chatMessages])

  const handleContinueResponse = useCallback(() => {
    submitChatMutation.mutate({
      chatMessages: chatMessages,
      conversationId: currentConversationId,
    })
  }, [submitChatMutation, chatMessages, currentConversationId])

  useEffect(() => {
    setFocusedMessageId(inputMessage.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const updateConversationAsync = async () => {
      try {
        if (chatMessages.length > 0) {
          createOrUpdateConversation(currentConversationId, chatMessages)
        }
      } catch (error) {
        new Notice('Failed to save chat history')
        console.error('Failed to save chat history', error)
      }
    }
    updateConversationAsync()
  }, [currentConversationId, chatMessages, createOrUpdateConversation])

  // Updates the currentFile of the focused message (input or chat history)
  // This happens when active file changes or focused message changes
  const handleActiveLeafChange = useCallback(() => {
    const activeFile = app.workspace.getActiveFile()
    if (!activeFile) return

    const mentionable: Omit<MentionableCurrentFile, 'id'> = {
      type: 'current-file',
      file: activeFile,
    }

    if (!focusedMessageId) return
    if (inputMessage.id === focusedMessageId) {
      setInputMessage((prevInputMessage) => ({
        ...prevInputMessage,
        mentionables: [
          mentionable,
          ...prevInputMessage.mentionables.filter(
            (mentionable) => mentionable.type !== 'current-file',
          ),
        ],
      }))
    } else {
      setChatMessages((prevChatHistory) =>
        prevChatHistory.map((message) =>
          message.id === focusedMessageId && message.role === 'user'
            ? {
                ...message,
                mentionables: [
                  mentionable,
                  ...message.mentionables.filter(
                    (mentionable) => mentionable.type !== 'current-file',
                  ),
                ],
              }
            : message,
        ),
      )
    }
  }, [app.workspace, focusedMessageId, inputMessage.id])

  useEffect(() => {
    app.workspace.on('active-leaf-change', handleActiveLeafChange)
    return () => {
      app.workspace.off('active-leaf-change', handleActiveLeafChange)
    }
  }, [app.workspace, handleActiveLeafChange])

  useImperativeHandle(ref, () => ({
    openNewChat: (selectedBlock?: MentionableBlockData) =>
      handleNewChat(selectedBlock),
    addSelectionToChat: (selectedBlock: MentionableBlockData) => {
      const mentionable: Omit<MentionableBlock, 'id'> = {
        type: 'block',
        ...selectedBlock,
      }

      setAddedBlockKey(getMentionableKey(serializeMentionable(mentionable)))

      if (focusedMessageId === inputMessage.id) {
        setInputMessage((prevInputMessage) => {
          const mentionableKey = getMentionableKey(
            serializeMentionable(mentionable),
          )
          // Check if mentionable already exists
          if (
            prevInputMessage.mentionables.some(
              (m) =>
                getMentionableKey(serializeMentionable(m)) === mentionableKey,
            )
          ) {
            return prevInputMessage
          }
          return {
            ...prevInputMessage,
            mentionables: [...prevInputMessage.mentionables, mentionable],
          }
        })
      } else {
        setChatMessages((prevChatHistory) =>
          prevChatHistory.map((message) => {
            if (message.id === focusedMessageId && message.role === 'user') {
              const mentionableKey = getMentionableKey(
                serializeMentionable(mentionable),
              )
              // Check if mentionable already exists
              if (
                message.mentionables.some(
                  (m) =>
                    getMentionableKey(serializeMentionable(m)) ===
                    mentionableKey,
                )
              ) {
                return message
              }
              return {
                ...message,
                mentionables: [...message.mentionables, mentionable],
              }
            }
            return message
          }),
        )
      }
    },
    focusMessage: () => {
      if (!focusedMessageId) return
      chatUserInputRefs.current.get(focusedMessageId)?.focus()
    },
  }))

  return (
    <div
      className="smtcmp-chat-container"
      data-response-phase={
        submitChatMutation.isPending ? responsePhase : 'idle'
      }
    >
      <div className="smtcmp-chat-header">
        <h1 className="smtcmp-chat-header-title">Chat</h1>
        <div className="smtcmp-chat-header-buttons">
          <button
            onClick={() => handleNewChat()}
            className="clickable-icon"
            aria-label="New Chat"
          >
            <Plus size={18} />
          </button>
          <ChatListDropdown
            chatList={chatList}
            currentConversationId={currentConversationId}
            onSelect={async (conversationId) => {
              if (conversationId === currentConversationId) return
              await handleLoadConversation(conversationId)
            }}
            onDelete={async (conversationId) => {
              await deleteConversation(conversationId)
              if (conversationId === currentConversationId) {
                const nextConversation = chatList.find(
                  (chat) => chat.id !== conversationId,
                )
                if (nextConversation) {
                  void handleLoadConversation(nextConversation.id)
                } else {
                  handleNewChat()
                }
              }
            }}
            onUpdateTitle={async (conversationId, newTitle) => {
              await updateConversationTitle(conversationId, newTitle)
            }}
          >
            <History size={18} />
          </ChatListDropdown>
          <button
            onClick={() => {
              new TemplateSectionModal(app).open()
            }}
            className="clickable-icon"
            aria-label="Prompt Templates"
          >
            <Book size={18} />
          </button>
        </div>
      </div>
      <div className="smtcmp-chat-messages" ref={chatMessagesRef}>
        {groupedChatMessages.map((messageOrGroup, index) =>
          !Array.isArray(messageOrGroup) ? (
            <div
              className="smtcmp-message-anchor"
              data-message-id={messageOrGroup.id}
              key={messageOrGroup.id}
            >
              <UserMessageItem
                message={messageOrGroup}
                chatUserInputRef={(ref) =>
                  registerChatUserInputRef(messageOrGroup.id, ref)
                }
                onInputChange={(content) => {
                  setChatMessages((prevChatHistory) =>
                    prevChatHistory.map((message) =>
                      message.role === 'user' &&
                      message.id === messageOrGroup.id
                        ? { ...message, content }
                        : message,
                    ),
                  )
                }}
                onSubmit={(content, useVaultSearch) => {
                  if (editorStateToPlainText(content).trim() === '') return
                  handleUserMessageSubmit({
                    inputChatMessages: [
                      ...groupedChatMessages
                        .slice(0, index)
                        .flatMap((messageOrGroup): ChatMessage[] =>
                          !Array.isArray(messageOrGroup)
                            ? [messageOrGroup]
                            : messageOrGroup,
                        ),
                      {
                        role: 'user',
                        content: content,
                        promptContent: null,
                        id: messageOrGroup.id,
                        mentionables: messageOrGroup.mentionables,
                      },
                    ],
                    useVaultSearch,
                  })
                  chatUserInputRefs.current.get(inputMessage.id)?.focus()
                }}
                onFocus={() => {
                  setFocusedMessageId(messageOrGroup.id)
                }}
                onMentionablesChange={(mentionables) => {
                  setChatMessages((prevChatHistory) =>
                    prevChatHistory.map((message) =>
                      message.id === messageOrGroup.id
                        ? { ...message, mentionables }
                        : message,
                    ),
                  )
                }}
              />
            </div>
          ) : (
            <AssistantToolMessageGroupItem
              key={messageOrGroup.at(0)?.id}
              messages={messageOrGroup}
              contextMessages={groupedChatMessages
                .slice(0, index + 1)
                .flatMap((messageOrGroup): ChatMessage[] =>
                  !Array.isArray(messageOrGroup)
                    ? [messageOrGroup]
                    : messageOrGroup,
                )}
              conversationId={currentConversationId}
              isStreaming={
                submitChatMutation.isPending &&
                index === groupedChatMessages.length - 1
              }
              isApplying={applyMutation.isPending}
              onApply={handleApply}
              onToolMessageUpdate={handleToolMessageUpdate}
            />
          ),
        )}
        <ImageQueuePanel
          conversationId={currentConversationId}
          onLocateOrigin={locateMessage}
        />
        <QueryProgress state={queryProgress} />
        {submitChatMutation.isPending &&
          responsePhase === 'waiting' &&
          queryProgress.type === 'idle' && <ResponsePendingIndicator />}
        {showContinueResponseButton && (
          <div className="smtcmp-continue-response-button-container">
            <button
              className="smtcmp-continue-response-button"
              onClick={handleContinueResponse}
            >
              <div>Continue Response</div>
            </button>
          </div>
        )}
        {submitChatMutation.isPending && (
          <button onClick={abortActiveStreams} className="smtcmp-stop-gen-btn">
            <CircleStop size={16} />
            <div>Stop Generation</div>
          </button>
        )}
        <QueuedPrompts
          prompts={queuedPrompts}
          paused={submitChatMutation.isError}
          onResume={() => submitChatMutation.reset()}
          onCancel={(prompt) => {
            void plugin.conversationRunManager?.cancel(
              currentConversationId,
              prompt.id,
            )
          }}
          onEdit={(prompt) => {
            void plugin.conversationRunManager?.cancel(
              currentConversationId,
              prompt.id,
            )
            setInputMessage(prompt.message)
          }}
          onSendNow={(prompt) => {
            abortActiveStreams()
            void plugin.conversationRunManager
              ?.cancel(currentConversationId, prompt.id)
              .then(() =>
                plugin.conversationRunManager?.enqueue(
                  currentConversationId,
                  prompt,
                  true,
                ),
              )
          }}
        />
      </div>
      <ChatUserInput
        key={inputMessage.id} // this is needed to clear the editor when the user submits a new message
        ref={(ref) => registerChatUserInputRef(inputMessage.id, ref)}
        initialSerializedEditorState={inputMessage.content}
        onChange={(content) => {
          setInputMessage((prevInputMessage) => ({
            ...prevInputMessage,
            content,
          }))
        }}
        onSubmit={(content, useVaultSearch, mode = 'chat') => {
          const plainText = editorStateToPlainText(content).trim()
          if (plainText === '') return
          const imageModel = resolveImageGenerationModel(settings)
          const canGenerateImages = imageModel.model !== null
          if (mode === 'image' && !canGenerateImages) {
            new Notice(imageModel.reason ?? 'No image generation model.')
            return
          }
          const taskManager = plugin.backgroundTaskManager
          const conversationImageTasks =
            taskManager
              ?.getTasks(currentConversationId)
              .filter((task) => task.kind === 'image-generation') ?? []
          let previousImagePrompt: string | undefined
          for (
            let index = conversationImageTasks.length - 1;
            index >= 0;
            index--
          ) {
            const task = conversationImageTasks[index]
            if (typeof task.input.batchBasePrompt === 'string') {
              previousImagePrompt = task.input.batchBasePrompt
              break
            }
            if (
              typeof task.input.prompt === 'string' &&
              !isImageGenerationContinuation(task.input.prompt)
            ) {
              previousImagePrompt = task.input.prompt
              break
            }
          }
          const imageRequest = parseImageGenerationRequest(plainText, {
            force: mode === 'image',
            previousPrompt: previousImagePrompt,
          })
          const resolvedImageModel = imageModel.model
          if (resolvedImageModel && imageRequest && taskManager) {
            const userMessage = { ...inputMessage, content }
            setChatMessages((messages) => [...messages, userMessage])
            if (imageModel.usedChatModelFallback) {
              new Notice(
                `Image model "${settings.imageGeneration.modelId}" is unavailable. Using ${resolvedImageModel.id}.`,
              )
            }
            if (imageRequest.requestedCount > MAX_IMAGE_BATCH_COUNT) {
              new Notice(
                `A maximum of ${MAX_IMAGE_BATCH_COUNT} images can be queued at once. Queuing ${MAX_IMAGE_BATCH_COUNT}.`,
              )
            }
            const targetFilePath = app.workspace.getActiveFile()?.path
            const referenceImages = inputMessage.mentionables.filter(
              (mentionable): mentionable is MentionableImage =>
                mentionable.type === 'image',
            )
            void (async () => {
              const eagleBridge = getEagleBridge(app)
              const shouldAsk =
                settings.imageGeneration.destination === 'cmds-eagle' &&
                destinationFromPasteBehavior(
                  getEaglePasteBehavior(eagleBridge),
                ) === 'ask'
              const destination = shouldAsk
                ? await new ImageDestinationModal(app, eagleBridge).choose()
                : undefined
              if (destination === null) {
                new Notice('Image generation canceled.')
                return
              }
              let referenceImagePaths: string[]
              try {
                referenceImagePaths = await storeReferenceImages({
                  app,
                  images: referenceImages,
                  batchId: inputMessage.id,
                })
              } catch (error) {
                new Notice(
                  `Reference images could not be saved: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                )
                return
              }
              const result = await enqueueImageGenerationBatch(
                taskManager,
                imageRequest,
                {
                  conversationId: currentConversationId,
                  originMessageId: inputMessage.id,
                  sourcePrompt:
                    getImageGenerationPrompt(plainText) || plainText,
                  modelId: resolvedImageModel.id,
                  targetFilePath,
                  referenceImagePaths,
                  destination,
                },
              )
              if (result.error) {
                new Notice(
                  `Queued ${result.queuedCount} of ${result.total} images. ${
                    result.error instanceof Error
                      ? result.error.message
                      : String(result.error)
                  }`,
                )
              }
            })()
            setInputMessage(getNewInputMessage(app))
            return
          }
          const userMessage = { ...inputMessage, content }
          if (submitChatMutation.isPending) {
            void plugin.conversationRunManager?.enqueue(currentConversationId, {
              id: userMessage.id,
              message: userMessage,
              createdAt: Date.now(),
              useVaultSearch,
            })
            setInputMessage(getNewInputMessage(app))
            return
          }
          handleUserMessageSubmit({
            inputChatMessages: [...chatMessages, userMessage],
            useVaultSearch,
          })
          setInputMessage(getNewInputMessage(app))
        }}
        onFocus={() => {
          setFocusedMessageId(inputMessage.id)
        }}
        mentionables={inputMessage.mentionables}
        setMentionables={(mentionables) => {
          setInputMessage((prevInputMessage) => ({
            ...prevInputMessage,
            mentionables,
          }))
        }}
        autoFocus
        addedBlockKey={addedBlockKey}
      />
    </div>
  )
})

Chat.displayName = 'Chat'

export default Chat
