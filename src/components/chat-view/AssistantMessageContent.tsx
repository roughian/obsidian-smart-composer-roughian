import React, { useCallback, useMemo } from 'react'

import { ChatAssistantMessage, ChatMessage } from '../../types/chat'
import {
  ParsedTagContent,
  parseTagContents,
} from '../../utils/chat/parse-tag-content'

import AssistantMessageReasoning from './AssistantMessageReasoning'
import MarkdownCodeComponent from './MarkdownCodeComponent'
import MarkdownReferenceBlock from './MarkdownReferenceBlock'
import { StableObsidianMarkdown } from './ObsidianMarkdown'

export default function AssistantMessageContent({
  content,
  isStreaming = false,
  contextMessages,
  handleApply,
  isApplying,
}: {
  content: ChatAssistantMessage['content']
  isStreaming?: boolean
  contextMessages: ChatMessage[]
  handleApply: (blockToApply: string, contextMessages: ChatMessage[]) => void
  isApplying: boolean
}) {
  const onApply = useCallback(
    (blockToApply: string) => handleApply(blockToApply, contextMessages),
    [contextMessages, handleApply],
  )

  return (
    <AssistantTextRenderer
      isStreaming={isStreaming}
      onApply={onApply}
      isApplying={isApplying}
    >
      {content}
    </AssistantTextRenderer>
  )
}

const AssistantTextRenderer = React.memo(function AssistantTextRenderer({
  children,
  isStreaming,
  onApply,
  isApplying,
}: {
  children: string
  isStreaming: boolean
  onApply: (blockToApply: string) => void
  isApplying: boolean
}) {
  const blocks: ParsedTagContent[] = useMemo(
    () => parseTagContents(children),
    [children],
  )

  return (
    <>
      {blocks.map((block, index) =>
        block.type === 'string' ? (
          <div key={index}>
            <StableObsidianMarkdown
              content={block.content}
              scale="sm"
              active={isStreaming && index === blocks.length - 1}
            />
          </div>
        ) : block.type === 'think' ? (
          <AssistantMessageReasoning key={index} reasoning={block.content} />
        ) : block.startLine && block.endLine && block.filename ? (
          <MarkdownReferenceBlock
            key={index}
            filename={block.filename}
            startLine={block.startLine}
            endLine={block.endLine}
          />
        ) : (
          <MarkdownCodeComponent
            key={index}
            onApply={onApply}
            isApplying={isApplying}
            language={block.language}
            filename={block.filename}
          >
            {block.content}
          </MarkdownCodeComponent>
        ),
      )}
    </>
  )
})
