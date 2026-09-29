import Link from 'next/link'

export default function OrderNotFound() {
  return <section className="border border-white/10 bg-zinc-900/50 p-8 sm:p-10">
    <h1 className="text-2xl font-semibold text-white">Order not found</h1>
    <p className="mt-3 text-sm leading-6 text-zinc-400">This order is unavailable. It may not exist or may not belong to your account.</p>
    <Link href="/account/orders" className="button-light mt-6 inline-flex px-5 py-3 text-sm">Return to orders</Link>
  </section>
}
