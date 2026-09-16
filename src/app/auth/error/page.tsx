import Link from "next/link";

export default function AuthenticationErrorPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
      <section
        aria-labelledby="authentication-error-title"
        className="w-full max-w-md border border-white/10 bg-zinc-900/70 p-8 shadow-2xl shadow-black/30 sm:p-10"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
          EvoLeVeX
        </p>
        <div className="mt-8 border-l border-amber-400 pl-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-300">
            Access unavailable
          </p>
          <h1
            id="authentication-error-title"
            className="mt-3 text-3xl font-semibold tracking-tight text-white"
          >
            Authentication Error
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-400">
            This authentication link may have expired, already been used, or is
            invalid. Please return to the application and try again.
          </p>
        </div>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center border border-zinc-700 bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Return to EvoLeVeX
        </Link>
      </section>
    </main>
  );
}
