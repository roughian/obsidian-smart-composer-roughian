export type EagleItemSummary = { id: string; name: string; ext: string }

/** Eagle stores each original at `<library>/images/<id>.info/<name>.<ext>`. */
export function buildEagleOriginalPath(
  libraryPath: string,
  item: EagleItemSummary,
): string {
  const root = libraryPath.replace(/[\\/]+$/, '')
  return `${root}/images/${item.id}.info/${item.name}.${item.ext}`
}

export function pathToFileUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/')
  const withRoot = normalized.startsWith('/') ? normalized : `/${normalized}`
  return `file://${encodeURI(withRoot)}`
}

export function buildEagleDeeplink(itemId: string): string {
  return `eagle://item/${itemId}`
}

/** Original image rendered from the library, clicking it opens the item in Eagle. */
export function buildEagleEmbedMarkdown({
  item,
  originalPath,
}: {
  item: EagleItemSummary
  originalPath: string
}): string {
  const alt = item.name.replace(/[[\]]/g, ' ')
  return `[![${alt}](${pathToFileUrl(originalPath)})](${buildEagleDeeplink(item.id)})`
}
