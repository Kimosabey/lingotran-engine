import Link from "next/link";
import { REPO_URL } from "@/lib/data";

interface FooterProps {
  brand: string;
  variant?: "top" | "book";
  backHref?: string;
  wide?: boolean;
}

export function Footer({ brand, variant = "top", backHref = "/french", wide }: FooterProps) {
  const year = new Date().getFullYear();
  const maxW = wide ? "max-w-(--content-max-wide)" : "max-w-(--content-max)";
  return (
    <footer className="border-t border-border">
      <div className={"mx-auto flex flex-col gap-1 px-4 py-6 text-xs text-text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6 " + maxW}>
        <span>
          {brand} · <span>{year}</span> · Built by Harshan Aiyappa, Full Stack / AI Engineer
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
