import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Harshan Aiyappa" }],
  // Favicon/apple-touch-icon are served via the app/icon.png + app/apple-icon.png
  // file-convention (Next.js auto-generates the <link> tags) rather than this
  // field -- keeps a single source of truth instead of a manual icons block
  // that could drift out of sync with the actual files on disk. The OG image
  // comes from app/opengraph-image.tsx by the same convention, so no `images`
  // array is listed here either.
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    // The generated card is a real 1200x630 image, so it earns the large
    // format; the old `summary` was correct only because the image was a
    // letterboxed wordmark.
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  alternates: { canonical: "/" },
};

// Read the persisted theme before paint to avoid a flash of the wrong theme.
// Only ever sets the attribute when the user has made an explicit choice --
// leaving it unset is meaningful, because an un-stamped document follows
// prefers-color-scheme through `color-scheme` (see globals.css).
const themeInitScript = `(function(){try{var t=localStorage.getItem('lt-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${ibmPlexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-text font-sans" suppressHydrationWarning>
        {/* tabIndex={0} is NOT redundant here, despite <a href> being natively
            focusable. WebKit/Safari does not place links in the sequential
            focus order by default ("Press Tab to highlight each item on a
            webpage" is off), so without it the very first Tab skips straight
            past the skip link and it becomes unreachable by keyboard in Safari
            -- verified by the e2e suite, which caught exactly this after the
            attribute was removed as cleanup. Leave it. */}
        <a
          href="#main"
          tabIndex={0}
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <TooltipProvider delay={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
