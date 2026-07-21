# Extraction scope — deutsch-pruefung.de (for the content team)

Plain-English summary of what the German web-extraction module can and cannot
take, and what is needed to go further.

## Where we are

The extractor is built and working. It has already saved **113 public pages**
from deutsch-pruefung.de as clean, structured files (Markdown + JSON + a quality
check + a manifest), in the same format as our French corpus.

## ✅ CAN take — public pages (no login)

- **32 study guides / blog articles** — reading, listening, speaking, writing
  guides per level; grammar, vocabulary, and exam-strategy articles. Real
  learning material.
- **~80 exam & section info pages** — Goethe / telc / DTZ / TestDaF, by level
  (A1–C1) and skill (Lesen/Hören/Schreiben/Sprechen): format, structure,
  timing, tips.
- We can also capture hidden **public** bits (FAQ answers, collapsed sections)
  with browser rendering, and reorganize everything into study units.

## ❌ CANNOT take — inside the platform

- The **practice exercises** — the actual questions, answer keys, and audio
  behind **"Start Practice"** / the **login** (the "963 Questions" banks, etc.).
- **Why:**
  - The content sits behind a **login** and is loaded from the site's **`/api/`**,
    which their **`robots.txt` disallows**.
  - It is the platform's **copyrighted product** ("© Deutsch Prüfung. All rights
    reserved."). A personal account grants the right to *use* it, not to *copy*
    it — and that permission cannot be waived on the provider's behalf by an
    account holder.
- **This is true regardless of tier or method.** Free-tier questions count too
  ("free to use" ≠ "free to copy"). Normal scraping, a browser tool, or
  **screenshots/OCR** are all the same in copyright/terms.

## 🔑 What would unlock the in-platform content

Exactly one condition:

> We **own/operate** deutsch-pruefung.de, **or** we hold **written permission**
> from Deutsch Prüfung to export their content.

If so, the correct method is a **backend / database / API export we control** —
not scraping through the login. To proceed we would need:

1. Confirmation of ownership, or written authorization from the provider, and
2. Backend / API / database export access.

## Decision for the content team

- **Goal = public guides & exam info** → nothing to decide; already done, and we
  can enrich/organize further.
- **Goal = in-product exercises/questions** → first secure **(1) written
  authorization or ownership** and **(2) backend access**; then a proper export
  can be built.

One-line version: *Public info pages and guides — yes. Any actual exercises
(free or paid) — only with ownership or written permission, via the backend.*
