import Link from "next/link";
import { Byline } from "@/components/byline";
import { REPO_URL } from "@/lib/data";

interface FooterProps {
  brand: string;
  variant?: "top" | "book";
  backHref?: string;
}


export function Footer({ brand, variant = "top", backHref = "/french" }: FooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-(--content-max) flex-col gap-1 px-4 py-6 text-xs text-text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>
          {brand} · <span>{year}</span> · Built by{" "}
          <Byline name="Harshan Aiyappa" />
          , Full Stack / AI Engineer
        </span>
        {variant === "top" ? (
          <span>
            <a href={REPO_URL} target="_blank" rel="noopener" className="text-link underline underline-offset-2">
              GitHub
            </a>{" "}
            · Built on the Lingotran brand system
          </span>
        ) : (
          <span>
            <Link href={backHref} className="text-link underline underline-offset-2">
              ← Back to French
            </Link>
          </span>
        )}
      </div>
    </footer>
  );
}
