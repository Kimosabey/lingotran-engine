const GLYPHS: { char: string; left: string; top: string; size: number; duration: string; delay: string }[] = [
  { char: "é", left: "4%", top: "8%", size: 64, duration: "20s", delay: "-3s" },
  { char: "ü", left: "88%", top: "6%", size: 48, duration: "17s", delay: "-7s" },
  { char: "ç", left: "94%", top: "58%", size: 58, duration: "22s", delay: "-9s" },
  { char: "â", left: "70%", top: "72%", size: 46, duration: "21s", delay: "-11s" },
  { char: "ö", left: "28%", top: "34%", size: 30, duration: "18s", delay: "-4s" },
];

// Homepage-only ambient signature -- drifting language accent characters
// behind the hero, tied to the subject (language learning) rather than a
// generic decorative flourish.
export function HeroGlyphs() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -inset-x-[4%] -top-[10%] -bottom-[20%] -z-10 overflow-hidden hero-glyphs"
    >
      {GLYPHS.map((g) => (
        <span
          key={g.char}
          style={{
            left: g.left,
            top: g.top,
            fontSize: g.size,
            animationDuration: g.duration,
            animationDelay: g.delay,
          }}
        >
          {g.char}
        </span>
      ))}
    </div>
  );
}
