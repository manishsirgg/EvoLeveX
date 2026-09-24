import Link from 'next/link'

export default function ReportNotFound() {
  return <section className="grid min-h-72 place-items-center border border-dashed border-white/15 bg-zinc-900/30 px-6 py-14 text-center"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Evo Circle moderation</p><h1 className="mt-3 text-3xl font-semibold">Report not found.</h1><p className="mx-auto mt-3 max-w-lg leading-7 text-zinc-400">It may no longer exist, or the link may be invalid.</p><Link href="/admin/circle/reports" className="button-primary mt-6 px-5 py-3 text-sm">Back to reports</Link></div></section>
}
