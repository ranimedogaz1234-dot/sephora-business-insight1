import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-burgundy">404</p>
      <h1 className="mt-2 font-display text-3xl text-charcoal">This page does not exist</h1>
      <p className="mt-2 text-sm text-ink-2">
        Sections marked “Soon” in the navigation are planned and not available yet.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 w-fit items-center rounded-md bg-burgundy px-4 text-sm font-medium text-white transition-colors hover:bg-burgundy-deep"
      >
        Back to the executive overview
      </Link>
    </main>
  );
}
