import { ImageResponse } from "next/og";
import { metrics, qaGlobal } from "@/lib/data";

// A real 1200x630 share card, generated at build time.
//
// The previous OG image was /img/logo-color.png -- a 1819x571 wordmark, which
// social platforms letterbox into a thin strip of violet on white with no
// information in it. This one carries the actual claim and the numbers behind
// it, at the aspect ratio the platforms crop to.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "Lingotran Engine — Nothing paraphrased. Nothing dropped. Verbatim extraction from scanned language textbooks.";

export default function OpengraphImage() {
  const pages = metrics[1]?.num ?? "—";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          // The brand gradient, same stops as --grad-brand.
          background: "linear-gradient(135deg, #2c0a63 0%, #41009a 55%, #5a18c2 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#b79cff",
              fontWeight: 600,
            }}
          >
            Lingotran · Extraction Engine
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 82,
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: -2,
            }}
          >
            <span>Nothing paraphrased.</span>
            <span>Nothing dropped.</span>
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#ede6ff", maxWidth: 900 }}>
            Scanned textbooks and exam PDFs, transcribed verbatim and adversarially re-checked.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {[
            `${pages} pages`,
            `${qaGlobal.pct}% QA pass rate`,
            "Zero data loss",
          ].map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 600,
                padding: "12px 26px",
                borderRadius: 999,
                border: "2px solid rgba(255,255,255,0.28)",
                background: "rgba(255,255,255,0.10)",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
