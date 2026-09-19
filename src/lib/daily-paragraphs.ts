/** The single paragraph model used by public articles, previews, and the composer. */
export function splitEditorialParagraphs(content: string | null | undefined): string[] {
  if (!content) return []
  return content.replace(/\r\n?/g, '\n').trim().split(/\n[\t ]*\n+/).map((value) => value.trim()).filter(Boolean)
}

export function paragraphPositionOptions(content: string | null | undefined, previewLength = 72) {
  return [
    { value: 0, label: 'Before article begins' },
    ...splitEditorialParagraphs(content).map((paragraph, index) => {
      const singleLine = paragraph.replace(/\s+/g, ' ')
      const preview = singleLine.length > previewLength ? `${singleLine.slice(0, previewLength).trimEnd()}…` : singleLine
      return { value: index + 1, label: `After paragraph ${index + 1} — “${preview}”` }
    }),
  ]
}
