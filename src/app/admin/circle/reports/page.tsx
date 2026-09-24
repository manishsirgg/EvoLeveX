import Link from 'next/link'

import { requireAdmin } from '@/lib/admin-auth'
import { CIRCLE_REPORT_PAGE_SIZE, getAdminReports, REPORT_CONTENT_TYPES, REPORT_REASONS, REPORT_STATUSES, ReportContentType, ReportFilter, reportLabel, reportProfileName, ReportReason, ReportStatus } from '@/lib/admin-circle-reports'

const statusOptions = ['all', ...REPORT_STATUSES] as const
const typeOptions = ['all', ...REPORT_CONTENT_TYPES] as const
const reasonOptions = ['all', ...REPORT_REASONS] as const
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value }
function choice<T extends string>(value: string | undefined, options: readonly T[], fallback: T) { return options.includes(value as T) ? value as T : fallback }
function formatDate(value: string) { return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function statusClass(status: ReportStatus) {
  if (status === 'pending') return 'border-amber-300/40 text-amber-200'
  if (status === 'reviewed') return 'border-sky-300/40 text-sky-200'
  if (status === 'dismissed') return 'border-zinc-500 text-zinc-300'
  return 'border-emerald-400/40 text-emerald-200'
}
function hrefFor(values: { status: ReportFilter<ReportStatus>; contentType: ReportFilter<ReportContentType>; reason: ReportFilter<ReportReason>; page?: number }) {
  const params = new URLSearchParams()
  if (values.status !== 'pending') params.set('status', values.status)
  if (values.contentType !== 'all') params.set('type', values.contentType)
  if (values.reason !== 'all') params.set('reason', values.reason)
  if (values.page && values.page > 1) params.set('page', String(values.page))
  const query = params.toString()
  return `/admin/circle/reports${query ? `?${query}` : ''}`
}

export default async function CircleReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin()
  const params = await searchParams
  const status = choice(one(params.status), statusOptions, 'pending')
  const contentType = choice(one(params.type), typeOptions, 'all')
  const reason = choice(one(params.reason), reasonOptions, 'all')
  const requestedPage = Number(one(params.page))
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const result = await getAdminReports({ status, contentType, reason, page })
  const pageCount = Math.max(1, Math.ceil(result.count / CIRCLE_REPORT_PAGE_SIZE))
  const filtered = status !== 'pending' || contentType !== 'all' || reason !== 'all'

  return <section aria-labelledby="reports-title">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Circle · Moderation</p><h1 id="reports-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Member reports</h1><p className="mt-3 text-zinc-400">Review reported content, inspect its context, and record a clear disposition.</p></div><Link href="/admin/circle" className="button-secondary px-4 py-3 text-sm font-bold">Circle overview</Link></div>

    <nav aria-label="Filter reports by status" className="admin-filter-nav mt-8 flex gap-2 overflow-x-auto border-b border-white/10 pb-4">{statusOptions.map((item) => <Link key={item} href={hrefFor({ status: item, contentType, reason })} aria-current={status === item ? 'page' : undefined} className="min-w-max px-4 py-2 text-xs uppercase tracking-wider">{reportLabel(item)}</Link>)}</nav>
    <form action="/admin/circle/reports" className="mt-5 grid gap-4 border border-white/10 bg-zinc-900/40 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      {status !== 'pending' ? <input type="hidden" name="status" value={status} /> : null}
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Content type<select name="type" defaultValue={contentType} className="mt-2 w-full border border-white/15 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300">{typeOptions.map((item) => <option key={item} value={item}>{reportLabel(item)}</option>)}</select></label>
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Reason<select name="reason" defaultValue={reason} className="mt-2 w-full border border-white/15 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300">{reasonOptions.map((item) => <option key={item} value={item}>{reportLabel(item)}</option>)}</select></label>
      <button className="button-primary px-5 py-2.5 text-sm">Apply filters</button>
    </form>
    {one(params.error) ? <p role="alert" className="mt-6 border border-rose-400/30 bg-rose-400/5 p-5 text-rose-200">The requested report could not be found or loaded.</p> : null}
    {result.hasError ? <p role="alert" className="mt-6 border border-rose-400/30 bg-rose-400/5 p-5 text-rose-200">Reports or some related context could not be loaded completely. Please try again later.</p> : null}
    {!result.hasError && !result.reports.length ? <div className="mt-7 grid min-h-64 place-items-center border border-dashed border-white/15 bg-zinc-900/30 px-6 py-14 text-center"><div><h2 className="text-2xl font-semibold">{filtered ? 'No reports match these filters.' : 'The pending queue is clear.'}</h2><p className="mt-3 text-zinc-400">{filtered ? 'Adjust the status, content type, or reason.' : 'New member reports will appear here.'}</p>{filtered ? <Link href="/admin/circle/reports" className="button-secondary mt-6 px-5 py-3 text-sm font-bold">View pending reports</Link> : null}</div></div> : null}
    {result.reports.length ? <div className="mt-7 overflow-hidden border border-white/10"><p className="border-b border-white/10 bg-zinc-900/80 px-5 py-3 text-xs text-zinc-400"><span className="font-semibold text-white">{result.count}</span> matching report{result.count === 1 ? '' : 's'} · page {page} of {pageCount}</p><ul className="divide-y divide-white/10">{result.reports.map((report) => <li key={report.id} className="grid gap-5 bg-zinc-950/40 p-5 xl:grid-cols-[minmax(16rem,2fr)_minmax(12rem,1fr)_minmax(13rem,1fr)_auto] xl:items-center">
      <div className="min-w-0"><div className="flex flex-wrap gap-2"><span className={`border px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${statusClass(report.status)}`}>{reportLabel(report.status)}</span><span className="border border-white/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-300">{reportLabel(report.content_type)}</span><span className="border border-rose-300/25 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-rose-200">{reportLabel(report.reason)}</span></div><p className="mt-3 break-words text-sm leading-6 text-zinc-300">{report.details ? `${report.details.slice(0, 180)}${report.details.length > 180 ? '…' : ''}` : 'No additional details supplied.'}</p></div>
      <div className="text-sm leading-6"><p className="font-semibold text-white">{report.target.title || `${reportLabel(report.content_type)} target`}</p><p className={report.target.available ? 'text-zinc-400' : 'text-rose-200'}>{report.target.available ? `Target status: ${reportLabel(report.target.status)}` : 'Target unavailable'}</p>{report.content_type === 'article' || report.content_type === 'evo_tv_video' ? <p className="text-xs text-zinc-500">Shown for triage; no Circle content actions.</p> : null}</div>
      <div className="text-xs leading-6 text-zinc-400"><p>Reported by {reportProfileName(report.reporter)}</p><p>{formatDate(report.created_at)}</p>{report.reviewed_at ? <p>Reviewed {formatDate(report.reviewed_at)} by {reportProfileName(report.reviewer)}</p> : <p>Awaiting review</p>}</div>
      <Link href={`/admin/circle/reports/${report.id}`} className="button-secondary px-4 py-2.5 text-center text-sm font-bold">Review report</Link>
    </li>)}</ul></div> : null}
    {result.reports.length ? <nav aria-label="Report pages" className="mt-6 flex items-center justify-between gap-4"><div>{page > 1 ? <Link href={hrefFor({ status, contentType, reason, page: page - 1 })} className="button-secondary px-4 py-2.5 text-sm font-bold">← Previous</Link> : null}</div><p className="text-sm text-zinc-500">Page {page} of {pageCount}</p><div>{page < pageCount ? <Link href={hrefFor({ status, contentType, reason, page: page + 1 })} className="button-secondary px-4 py-2.5 text-sm font-bold">Next →</Link> : null}</div></nav> : null}
  </section>
}
