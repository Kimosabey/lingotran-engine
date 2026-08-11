import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Lingotran",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    // Matches --bg / --surface in light mode; the browser uses these before
    // the stylesheet lands, so they should be the light values (the theme
    // itself flips via color-scheme once the CSS is in).
    background_color: "#f6f5fb",
    theme_color: "#41009a",
    icons: [
      { src: "/img/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/img/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
