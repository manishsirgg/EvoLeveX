import Link from 'next/link'
import { redirect } from 'next/navigation'

import { VaultBookDownload } from '@/components/vault/vault-book-download'
import { createClient } from '@/lib/supabase/server'
import { getVaultLibrary } from '@/lib/vault-access'

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/auth/login')

  const library = await getVaultLibrary(supabase, user.id)

  return (
    <section aria-labelledby="library-title" className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Your collection</p>
        <h1 id="library-title" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">My Library</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">Your owned Evo Vault digital books, ready when you are.</p>
      </div>

      {library.hasError ? (
        <div role="alert" className="border border-amber-300/20 bg-amber-300/[0.05] p-5 text-sm text-amber-100">
          Your library could not be loaded. Refresh the page or try again shortly.
        </div>
      ) : library.books.length === 0 ? (
        <div className="border border-white/10 bg-zinc-900/50 p-8 sm:p-10">
          <h2 className="text-xl font-semibold text-white">Your next chapter starts here.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">Books you purchase from Evo Vault will appear here for secure download.</p>
          <Link href="/vault" className="button-light mt-6 inline-flex px-5 py-3 text-sm">Explore Evo Vault</Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {library.books.map((book) => (
            <article key={book.productId} className="flex flex-col border border-white/10 bg-zinc-900/60 p-5">
              <div className="aspect-[3/4] overflow-hidden bg-zinc-800">
                {book.coverImageUrl ? (
                  // Public catalog covers use the existing Supabase image infrastructure.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.coverImageUrl} alt={`Cover of ${book.name}`} className="h-full w-full object-cover" />
                ) : <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">Evo Vault</div>}
              </div>
              <div className="flex flex-1 flex-col pt-5">
                <h2 className="text-lg font-semibold leading-7 text-white">{book.name}</h2>
                {book.authorName ? <p className="mt-1 text-sm text-zinc-400">By {book.authorName}</p> : null}
                <p className="mt-3 text-xs text-zinc-500">Added {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(book.grantedAt))}</p>
                <div className="mt-auto pt-5"><VaultBookDownload productId={book.productId} title={book.name} /></div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
