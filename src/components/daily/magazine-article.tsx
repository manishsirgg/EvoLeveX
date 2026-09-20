import Link from 'next/link'
import { ArticleImage } from './article-image'
import { ArticleMeta } from './article-meta'
import { ArticleViewTracker } from './article-view-tracker'
import { ArticleBookmark } from './article-bookmark'
import { ArticleShare } from './article-share'
import { MagazineBlock } from './magazine-block'
import { DailyArticle, DailyArticleSummary } from '@/lib/daily'
import { DailyBlock, DailyBlockResources } from '@/lib/daily-blocks'
import { splitEditorialParagraphs } from '@/lib/daily-paragraphs'
import { RelatedArticles } from './related-articles'

export function MagazineArticle({ article, blocks, resources, preview = false, viewCount, bookmark, shareUrl, relatedArticles = [] }: { article: DailyArticle; blocks: DailyBlock[]; resources: DailyBlockResources; preview?: boolean; viewCount?: number; bookmark?: { authenticated: boolean; saved: boolean }; shareUrl?: string; relatedArticles?: DailyArticleSummary[] }) {
  const paragraphs = splitEditorialParagraphs(article.content)
  const grouped = new Map<number, DailyBlock[]>()
  for (const block of blocks) { const position = Math.min(Math.max(0, block.position_after_paragraph), paragraphs.length); grouped.set(position, [...(grouped.get(position) ?? []), block]) }
  const slot = (position: number) => grouped.get(position)?.map((block) => <MagazineBlock key={block.id} block={block} resources={resources} />)
  const authorName = article.author?.display_name || article.author?.username
  return <main className="article-page"><article>
    {preview && <div className="preview-banner"><strong>Admin preview</strong><span>This article may not be public.</span><Link href={`/admin/daily/${article.id}/edit`}>Back to editor</Link></div>}
    <Link href={preview ? `/admin/daily/${article.id}/edit` : '/daily'} className="article-back"><span aria-hidden="true">←</span> {preview ? 'Back to editor' : 'Back to Evo Daily'}</Link>
    <header className="article-header">{article.category && <p className="section-kicker">{article.category.name}</p>}<h1>{article.title}</h1>{article.excerpt && <p className="article-deck">{article.excerpt}</p>}<ArticleMeta publishedAt={article.published_at} readTime={article.read_time_minutes} author={authorName} views={!preview && viewCount !== undefined ? <ArticleViewTracker slug={article.slug} initialCount={viewCount} /> : undefined} />{!preview && bookmark && shareUrl ? <div className="article-actions"><ArticleBookmark articleId={article.id} articlePath={`/daily/${encodeURIComponent(article.slug)}`} authenticated={bookmark.authenticated} initiallySaved={bookmark.saved} /><ArticleShare title={article.title} excerpt={article.excerpt} url={shareUrl} /></div> : null}</header>
    {article.featured_image_url ? <ArticleImage src={article.featured_image_url} alt={`${article.title} featured image`} priority className="article-hero-image" /> : null}
    <div className="magazine-body">{slot(0)}{paragraphs.length ? paragraphs.map((paragraph, index) => <div key={`${index}-${paragraph.slice(0, 20)}`}><p className="article-paragraph">{paragraph.split('\n').map((line, lineIndex) => <span key={lineIndex}>{line}{lineIndex < paragraph.split('\n').length - 1 && <br />}</span>)}</p>{slot(index + 1)}</div>) : <p className="article-content-empty">This article has no body content yet.</p>}</div>
    {article.tags.length > 0 && <footer className="article-tags" aria-label="Article topics"><p>Topics</p><ul>{article.tags.map((tag) => <li key={tag.id}>{tag.name}</li>)}</ul></footer>}
    {!preview && <RelatedArticles articles={relatedArticles} />}
  </article></main>
}
