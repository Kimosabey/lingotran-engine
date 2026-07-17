# How to resume the extraction (new chat)

State is checkpointed in `manifest.tsv`. The transcription pipeline is **idempotent and resumable** —
it only reprocesses pages whose `status` ≠ `verified`. Paste this to a new Claude Code chat in
`d:\Harshan\french-a1-a2`:

> Continue the French PDF extraction. Read `extracted/RESUME.md` and `extracted/MANIFEST.md`,
> then process all pages whose status is not `verified` and assemble the A1/A2 sections.

## Exact steps

1. See current state:
   ```
   cd d:\Harshan\french-a1-a2\extracted
   python _tools/manifest.py qa-apply        # fold any QA sidecars into manifest
   python _tools/manifest.py dashboard        # prints overall %; writes MANIFEST.md
   ```
2. Get the list of pending pages per book:
   ```
   python -c "import csv,json;p={};[p.setdefault(r['book'],[]).append(int(r['page'])) for r in csv.DictReader(open('manifest.tsv',encoding='utf-8'),delimiter='\t') if r['status']!='verified'];print(json.dumps(p))"
   ```
3. Run the pipeline on the pending pages (transcribe → QA → repair). Launch via the Workflow tool
   with `scriptPath` = `extracted/_tools/transcribe.workflow.js` and
   `args = {"book":"<slug>","src":"<pdf name>","pages":[...pending...]}`.
   - Conjugaison: `book=conjugaison-a1-a2`, `src=PRATIQUE-CONJUGASION A1 A2.pdf`
   - Révision:    `book=revision-2`, `src=Pratique Révision 2.pdf`
   - Keep batches ≲ ~60 pages to fit a session; re-run for the rest. Always run
     `python _tools/manifest.py qa-apply` after each batch.
4. When `dashboard` shows **287/287 verified**, assemble sections (see `_tools/` + plan) into
   `<book>/sections/A1/` and `A2/`, then coverage-check that every page maps to exactly one section.

## Current checkpoint (2026-06-22)
- Conjugaison: 104/106 transcribed, 60/106 verified. Pending = the not-`verified` rows.
- Révision: 0/181 started.
- Pipeline validated; fidelity is high; orientation auto-fix and adversarial QA both working.
