import Link from 'next/link'
import { DailyBlock, DailyBlockResources, safeHttpUrl } from '@/lib/daily-blocks'

/* External editorial images are intentionally runtime-configurable and cannot use a fixed Next Image host allowlist. */
/* eslint-disable @next/next/no-img-element */

function Copy({ value }: { value: string | null }) { return value ? <p>{value}</p> : null }
function money(value: number | string | null, currency: string | null) {
  if (value === null) return null
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: currency || 'USD' }).format(Number(value)) } catch { return `${currency || ''} ${value}`.trim() }
}

export function MagazineBlock({ block, resources }: { block: DailyBlock; resources: DailyBlockResources }) {
  if (block.block_type === 'section_heading') {
    const heading = block.heading?.trim()
    return heading ? <section className="magazine-section-heading"><span aria-hidden="true" /><h2>{heading}</h2><Copy value={block.body} /></section> : null
  }
  if (block.block_type === 'pull_quote') return block.body ? <figure className="magazine-pull-quote"><blockquote>“{block.body}”</blockquote>{block.heading && <figcaption>— {block.heading}</figcaption>}</figure> : null
  if (block.block_type === 'divider') return <div className="magazine-divider" aria-hidden="true"><span>◆</span></div>
  if (block.block_type === 'image') {
    const url = safeHttpUrl(block.image_url); if (!url) return null
    const wide = block.metadata?.variant === 'wide'
    return <figure className={`magazine-image${wide ? ' magazine-image-wide' : ''}`}><img src={url} alt={block.image_alt || ''} />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>
  }
  if (block.block_type === 'callout') return <aside className="magazine-callout"><p className="magazine-label">Editor&apos;s note</p>{block.heading && <h3>{block.heading}</h3>}<Copy value={block.body} /></aside>
  if (block.block_type === 'evo_tv') {
    const video = block.evo_tv_video_id ? resources.videos[block.evo_tv_video_id] : null
    if (!video?.youtube_video_id) return null
    return <section className="magazine-video"><div className="magazine-promo-copy"><p className="magazine-label">Watch on Evo TV</p><h3>{video.title}</h3><Copy value={video.description} /></div><div className="magazine-video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.youtube_video_id)}`} title={video.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div></section>
  }
  if (block.block_type === 'evo_vault' || block.block_type === 'evo_store') {
    const item = block.block_type === 'evo_vault' ? (block.vault_product_id ? resources.vaultProducts[block.vault_product_id] : null) : (block.store_product_id ? resources.storeProducts[block.store_product_id] : null)
    if (!item) return null
    const isVault = block.block_type === 'evo_vault'; const price = money(isVault && 'price' in item ? item.price : !isVault && 'base_price' in item ? item.base_price : null, item.currency)
    return <aside className="magazine-product">{item.cover_image_url && safeHttpUrl(item.cover_image_url) ? <img src={item.cover_image_url} alt="" /> : null}<div><p className="magazine-label">From Evo {isVault ? 'Vault' : 'Store'}</p><h3>{item.name}</h3><p>{item.short_description}</p>{price && <strong>{price}</strong>}<p className="magazine-availability">Explore the {isVault ? 'Vault' : 'Store'} collection for availability.</p></div></aside>
  }
  if (block.block_type === 'affiliate') {
    const url = safeHttpUrl(block.external_url); if (!url) return null
    return <aside className="magazine-affiliate">{block.image_url && safeHttpUrl(block.image_url) ? <img src={block.image_url} alt={block.image_alt || ''} /> : null}<div><p className="magazine-label">Recommended</p>{block.heading && <h3>{block.heading}</h3>}<Copy value={block.body} /><a href={url} target="_blank" rel="noopener noreferrer sponsored" className="button-primary magazine-action">{block.button_label || 'View recommendation'} ↗</a>{block.affiliate_disclosure && <small>{block.affiliate_disclosure}</small>}</div></aside>
  }
  if (block.block_type === 'cta') {
    const url = block.external_url?.startsWith('/') ? block.external_url : safeHttpUrl(block.external_url); if (!url) return null
    const external = !url.startsWith('/')
    return <aside className="magazine-cta"><div>{block.heading && <h3>{block.heading}</h3>}<Copy value={block.body} /></div>{external ? <a className="button-primary magazine-action" href={url} target="_blank" rel="noopener noreferrer">{block.button_label || 'Learn more'} ↗</a> : <Link className="button-primary magazine-action" href={url}>{block.button_label || 'Learn more'} →</Link>}</aside>
  }
  return null
}
