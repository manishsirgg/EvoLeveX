export function ArticleContent({ content }: { content: string | null }) {
  const paragraphs = content?.trim().split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) ?? []

  if (paragraphs.length === 0) {
    return <div className="article-content article-content-empty"><p>This article has no body content yet.</p></div>
  }

  return (
    <div className="article-content">
      {paragraphs.map((paragraph, index) => {
        const lines = paragraph.split('\n')
        return (
          <p key={`${index}-${paragraph.slice(0, 24)}`}>{lines.map((line, lineIndex) => (
            <span key={lineIndex}>{line}{lineIndex < lines.length - 1 && <br />}</span>
          ))}</p>
        )
      })}
    </div>
  )
}
