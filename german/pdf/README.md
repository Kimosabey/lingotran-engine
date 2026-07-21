# German · pdf (raw PDF sources)

Raw, officially-published PDF source materials for the German corpus —
downloaded manually (browser, by hand), not scraped. Mirrors how French keeps
its source PDFs (`french/*.pdf`, gitignored) separate from processed output
in `french/extracted/`.

The actual PDF files are **not tracked in git** (see root `.gitignore`) —
only this structure and its companion audio in `../audio/` are.

## Layout

```
pdf/
  <publisher>/
    <exam-variant>/
      <file>.pdf
```

## Goethe-Institut — Goethe-Zertifikat A1

Source: https://www.goethe.de/en/spr/prf/ueb/pa1.html — official, free
practice materials published by the Goethe-Institut for exam candidates.

Save each downloaded file under `goethe-institut/<variant>/` using these
exact names (matched 1:1 with the audio in `../audio/goethe-institut/`):

### `goethe-institut/a1-start-deutsch-1/` (adults)
| Save as | Page description |
| --- | --- |
| `exam-training-1.pdf` | Exam training 1 A1 Adults (~1000 KB) |
| `exam-training-2.pdf` | Exam training 2 A1 Adults (~6 MB) |
| `exam-training-3.pdf` | Exam training 3 A1 Adults (~5 MB) |
| `vocabulary-list.pdf` | Vocabulary list — Start Deutsch 1 (~699 KB) |

### `goethe-institut/a1-fit-in-deutsch-1/` (young people)
| Save as | Page description |
| --- | --- |
| `exam-training-1.pdf` | Exam training 1 A1 Young people |
| `exam-training-2.pdf` | Exam training 2 A1 Young people (~2 MB) |
| `vocabulary-list.pdf` | Vocabulary list — A1 Young people (~388 KB) |

## Next step (once files are in place)

These are raw sources, not yet corpus content. A future PDF-extraction pass
(mirroring `french/extracted/_tools/transcribe.workflow.js`) turns them into
`german/extracted/` artifacts. Not built yet — out of scope for this drop.
