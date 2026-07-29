"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { MobileNav } from "@/components/mobile-nav";
import { sitePages, REPO_URL } from "@/lib/data";

function activeSlugFor(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg) return "dashboard";
  const match = sitePages.find((p) => p.path === seg);
  return match ? match.slug : "dashboard";
}

export interface Crumb {
  label: string;
  href?: string;
}

export function Header({ crumbs, wide }: { crumbs?: Crumb[]; wide?: boolean }) {
  const pathname = usePathname();
  const active = activeSlugFor(pathname);
  const activePage = sitePages.find((p) => p.slug === active);
  const defaultCrumbs: Crumb[] = activePage && active !== "dashboard" ? [{ label: activePage.label }] : [];
  const trail = crumbs ?? defaultCrumbs;
  const maxW = wide ? "max-w-(--content-max-wide)" : "max-w-(--content-max)";

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-surface/90 backdrop-blur">
        <div className={"mx-auto flex h-(--topbar-h) items-center gap-4 px-4 sm:px-6 " + maxW}>
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/img/logo-color.png"
              alt="Lingotran"
              width={80}
              height={25}
              className="block h-[25px] w-[80px] dark:hidden"
              priority
            />
            <Image
              src="/img/logo-white.png"
              alt="Lingotran"
              width={80}
              height={25}
              className="hidden h-[25px] w-[80px] dark:block"
              priority
            />
            <span className="hidden text-xs font-medium uppercase tracking-[0.08em] text-text-subtle sm:inline">
              Extraction Engine
            </span>
          </Link>
          <span className="flex-1" />
          <div className="hidden sm:block">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-1">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener"
              aria-label="GitHub repository"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <Icon name="github" size={18} />
            </a>
            <ThemeToggle />
            <MobileNav active={active} />
          </div>
        </div>
      </header>
      <nav className="sticky top-(--topbar-h) z-40 border-b border-border bg-surface/90 backdrop-blur" aria-label="Primary">
        <div className={"mx-auto flex h-12 items-center justify-between gap-4 px-4 sm:px-6 " + maxW}>
          <div className="hidden items-center gap-1 md:flex">
            {sitePages.map((p) => (
              <Link
                key={p.slug}
                href={"/" + p.path}
                aria-disabled={p.disabled}
                className={
                  "relative rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
                  (p.slug === active
                    ? "bg-brand-100 text-link"
                    : "text-text-muted hover:bg-surface-2 hover:text-text")
                }
              >
                {p.label}
                {p.slug === active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full"
                    style={{ background: "var(--grad-brand-90)" }}
                  />
                )}
              </Link>
            ))}
          </div>
          {trail.length > 0 && (
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto text-xs text-text-subtle">
              <Link href="/" className="shrink-0 hover:text-text">
                Home
              </Link>
              {trail.map((c, i) => (
                <span key={i} className="flex shrink-0 items-center gap-1.5">
                  <span aria-hidden="true">/</span>
                  {c.href ? (
                    <Link href={c.href} className="hover:text-text">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-text">{c.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
