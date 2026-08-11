import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Icon } from "@/components/icon";

export const metadata: Metadata = {
  title: "Page not found — Lingotran Engine",
};

export default function NotFound() {
  return (
    <>
      <Header crumbs={[{ label: "Not found" }]} />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 scroll-mt-(--sticky-stack) focus:outline-none"
      >
        <div className="mx-auto flex max-w-(--content-max) flex-col items-center gap-3 px-4 py-24 text-center sm:px-6">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-text-subtle">
            <Icon name="search" size={26} />
          </span>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-text sm:text-4xl">
            We couldn&rsquo;t find that page
          </h1>
          <p className="max-w-md text-base leading-relaxed text-text-muted">
            The page or corpus entry you&rsquo;re looking for doesn&rsquo;t exist — it may have moved, or the
            link might be out of date.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full bg-brand-700 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-900"
            >
              Back to home
            </Link>
            <Link
              href="/#corpus"
              className="inline-flex h-10 items-center rounded-full border border-border-strong px-5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
            >
              Explore the corpus
            </Link>
          </div>
        </div>
      </main>
      <Footer brand="Lingotran Engine" />
    </>
  );
}
