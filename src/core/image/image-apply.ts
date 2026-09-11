import { App } from 'obsidian'

import { ApplyViewState } from '../../ApplyView'
import { APPLY_VIEW_TYPE } from '../../constants'
import { findMarkdownInsertionView } from '../../utils/obsidian/markdownInsertion'

/**
 * Inserts `markdown` as its own line next to `cursorLine` (or at the end when
 * null): on the cursor line itself when it is blank, otherwise right below it.
 * Keeping it on a separate line lets the Apply view offer the usual
 * Accept Incoming / Current / Both choices without touching existing text.
 */
export function insertMarkdownAtCursorLine({
  content,
  markdown,
  cursorLine,
}: {
  content: string
  markdown: string
  cursorLine: number | null
}): string {
  const lines = content.split('\n')
  const anchor = Math.min(cursorLine ?? lines.length - 1, lines.length - 1)
  const insertAt = lines[anchor].trim() === '' ? anchor : anchor + 1
  lines.splice(insertAt, 0, markdown)
  return lines.join('\n')
}

/**
 * Opens the diff-based Apply view with the image reference added to the note
 * under the cursor. Returns false when no note is available.
 */
export async function openImageApplyView({
  app,
  markdown,
  preferredFilePath,
}: {
  app: App
  markdown: string
  preferredFilePath?: string
}): Promise<boolean> {
  const view = findMarkdownInsertionView(app, preferredFilePath)
  const file = view?.file ?? app.workspace.getActiveFile()
  if (!file) return false
  const cursorLine =
    view && view.file?.path === file.path ? view.editor.getCursor().line : null
  const originalContent = await app.vault.read(file)
  const newContent = insertMarkdownAtCursorLine({
    content: originalContent,
    markdown,
    cursorLine,
  })
  await app.workspace.getLeaf(true).setViewState({
    type: APPLY_VIEW_TYPE,
    active: true,
    state: { file, originalContent, newContent } satisfies ApplyViewState,
  })
  return true
}
