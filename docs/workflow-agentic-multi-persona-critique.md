# Lingotran Engine — Multi-Persona Critique

**Date:** 2026-08-10  
**Scope:** Workflows, pipeline, and agentic design (PDF extraction + German web channel + presentation sites)  
**Sources:** `_engine/EXTRACTION-WORKFLOW.md`, `PLAYBOOK.md`, `agent_*.md`, `german/extracted/ORCHESTRATION-AND-MODELS.md`, reconcile/verify/export tools, `german/web` pipeline, `site-next/lib/data.ts`  
**Nature:** Qualitative architecture review from repository state — not a live run cost measurement.

---

## Verdict

Best-in-class **craft extraction ops** for a solo/small team. Mechanisms (atomic pages, adversarial QA, disk-truth resume, frozen deliverables) are unusually mature.

Weak spots are deliberate absences — job queue, model gateway, automated orchestrator — plus unpaid tech debt: parallel pipelines, full-page vision QA by default, hand-synced site stats.

**This is not a coded agent framework.** It is a disk-truth corpus factory driven by Claude subagents + Python gates. Frontends document and display metrics; they do not run extraction.

| Lens | Grade |
|---|---|
| Safety / zero-loss | **A−** |
| Agentic design | **B** |
| Cost efficiency | **C+** |
| Productizability | **C** |

---

## Product summary

Lingotran Engine turns language-learning PDFs (and one authorized German website) into structured study corpora: per-page Markdown transcriptions, adversarial QA sidecars, question banks, vocabulary lists, and CSV/Markdown exports. Guiding invariant: **zero data loss** (verbatim transcription, repair-until-pass QA).

Orchestration is a human (or Claude Code parent session) driving Python CLIs + vision/text subagents. Job state lives on disk (manifest TSV + per-page files).

---

## Pipeline at a glance

Hybrid: deterministic Python ↔ LLM vision/text. State = files under `<lang>/extracted/<slug>/`. No HTTP job API.

| Stage | Runner | What happens |
|---|---|---|
| 1. Recon | Human/agent | Level mode, answer keys, text-layer? |
| 2. Rasterize | Python | `pdf_to_images` → `page-NNN.png` |
| 3. Transcribe | Vision agent | Verbatim MD + rotate/zoom tools |
| 4. Adversarial QA | Vision agent | Independent re-read → `_qa` JSON |
| 5. Repair loop | Vision agent | Fix → re-verify from image |
| 6. Enrich | Text agent | Classify + questions (+ vocab) |
| 7. Merge / gates | Python | merge → reconcile → verify_answers |
| 8. Export | Python | CSV/MD + package `_exports/` |

### Parallel systems (important)

| Path | Role |
|---|---|
| `_engine/` | Shared PDF engine (canonical for new French / future langs) |
| `german/extracted/_tools/` | Original German PDF pipeline (frozen Goethe reference) |
| French legacy Workflow JS | Older books still on `manifest.py` + `transcribe.workflow.js` |
| `german/web/` | TypeScript adapter pipeline (deutsch-pruefung.de) — out of PDF registry |

---

## Persona scorecards

| Persona | Grade | What they love | What they hate | Ask next |
|---|---|---|---|---|
| Agentic systems eng | **B+** | Clear role split; disk-truth resume; prompt-as-artifact | No coded DAG; orchestrator is tribal knowledge | Encode dispatch + gates as a thin runner |
| Reliability / SRE | **A−** | Atomic writes; reconcile exit codes; frozen corpora | Human cadence = SPOF; no queue under concurrency cap | Persist run ledger + auto-resume from gaps |
| Cost / FinOps | **C+** | Cheap text enrichment; honest cost postmortem | Full vision QA on every page; text-layer still optional | Text-layer first + tiered QA (ORCHESTRATION §5) |
| Curriculum / product | **A** | Zero-loss invariant; caveats; answer verify | Hand-synced site metrics; web corpus orphaned | Single corpus index feeding exports + site |
| Security / compliance | **B** | Face-crop playbook; no secrets in engine | Agents write freely; copyright risk is ops-only | Allowlist write roots; license field on collections |
| Operator onboarding | **B−** | EXTRACTION-WORKFLOW + PLAYBOOK are excellent | 3 parallel PDF paths; Workflow JS vs agent.md drift | Deprecate legacy French path; one playbook entry |
| Eval / QA eng | **B** | Adversarial QA; verify_answers; unit tests on gates | No golden-page regression suite; no LLM-judge harness | Freeze 20 hard pages as CI fidelity fixtures |
| Founder / scale | **C** | Proven on 636 DE + FR books; multi-lang `--root` | Not productizable; subscription headroom is capacity | Decide: craft corpus factory vs SaaS pipeline |

---

## Findings by severity

| Sev | Area | Finding | Personas |
|---|---|---|---|
| **P0** | Cost path | Text-layer shortcut documented but not default — burns vision budget on digital PDFs | FinOps + Agentic |
| **P0** | Drift | German `_tools/`, shared `_engine/`, French legacy Workflow JS — three truths for one idea | Operator + SRE |
| **P1** | Orchestration | No job queue by design; rolling ≤20 subagents reject excess — throughput is session discipline | SRE + Founder |
| **P1** | Agent writes | Agents bypass Python atomics; safety is detect-after-the-fact (`reconcile`), not prevent | Reliability + Security |
| **P1** | Metrics | `site-next` `data.ts` is hand-authored — dashboard can lie vs CSV row counts | Product |
| **P2** | QA spend | ~35% of tokens re-read every image; tiered QA still aspirational | FinOps |
| **P2** | Web channel | deutsch-pruefung corpus outside `collections.json` / PDF export registry | Product |
| **P2** | Eval | Gates catch completeness & answer shape; no frozen golden pages for transcription fidelity | Eval |

---

## Deep cuts by persona

### Agentic systems engineer

**What works:** Roles are explicit (transcriber / QA / repair / enrich / packager). Prompts are versioned contracts with parameters, tools (`rotate`/`zoom`), and a one-line STEP 5 contract. Disk is the blackboard — classic blackboard-agent pattern without the framework tax.

**Critique:** You call it agentic, but the planner is outside the repo: a human or parent Claude session. That is fine for craft work; it fails the “another engineer restarts a book cold” test. Workflow JS approximates a 3-stage graph when available, then you fall back to `agent.md` loops — two control planes.

**Would ship:** A thin orchestrator CLI that fills params, dispatches batches from disk gaps, and refuses to mark CLEAN until reconcile+verify exit 0.

---

### Reliability / SRE

**What works:** The five zero-loss mechanisms are production-grade thinking: atomic per-page writes, adversarial QA, repair-until-pass, disk-truth over agent claims, derived manifests. `reconcile.py` as a hard gate is the right culture.

**Critique:** Capacity is “subscription headroom + don’t launch 20 agents into an exhausted account.” Failures are recoverable but not self-healing. Concurrency cap rejects work; nothing queues. Agent file writes can still clobber if they ignore atomics — you detect, you don’t prevent.

**Would ship:** Run ledger (batch id, pages, model, exit) + auto re-dispatch only of reconcile gaps.

---

### Cost / FinOps

**What works:** `ORCHESTRATION-AND-MODELS.md` is unusually honest: ~80% spend on vision+QA, avoidable waste named (~10% dead mid-write, full QA on trivial pages, unused text layers). Vision/text model split is correct.

**Critique:** The lean design in §5 is still mostly aspirational. You already know the ROI order: text-layer detect → tiered QA → effort by `content_type` → one-pass enrich. Until those are defaults, every new digital PDF taxes the same expensive path as a skew scan.

**Would ship:** `page.get_text()` gate as Step 0 in EXTRACTION-WORKFLOW, not a footnote.

---

### Curriculum product

**What works:** Taxonomy discipline (English enums, source-language verbatim), `level_mode` fixed vs inferred, caveats + `accepted_qa_gaps` as disclosed debt, frozen Goethe protection. `verify_answers` catching bare-letter MC is product-quality thinking.

**Critique:** Presentation layer can drift from corpus truth. Web extraction is architecturally clean but inventory-orphan. Remaining French books registered-not-started means the “engine” story is ahead of the catalog story.

**Would ship:** Generate site metrics from export CSVs in CI.

---

### Security / compliance

**What works:** Content-filter face crop is a real incident playbook, not a slogan. No API keys in `_engine`; usage stays in Claude harness. Frozen paths reduce accidental overwrite of delivered assets.

**Critique:** Agents have broad write surface. Copyright / licensing is operational judgment, not schema. No audit trail of which model produced which page beyond what’s in chat history.

**Would ship:** `collections.license` + agent write-root allowlist in the prompt/orchestrator.

---

### Operator / onboarding

**What works:** `EXTRACTION-WORKFLOW.md` + `PLAYBOOK.md` are among the best internal runbooks for LLM pipelines — incident-driven, concrete commands, “never edit derived files.”

**Critique:** Cognitive load: German tools vs `_engine` vs French legacy Workflow with hardcoded paths. New hire must learn which books are on which path. Schema naming drift (`teil` vs `part`) is a footgun for multi-lang merges.

**Would ship:** One “canonical path” badge per collection in `collections.json`.

---

### Eval / QA eng

**What works:** Adversarial second pass, repair-until-pass, `reconcile.py`, `verify_answers.py`, unit tests on gates, disclosed `accepted_qa_gaps`.

**Critique:** No frozen golden-page set that fails CI if a prompt regression drops cells/accents. No automated LLM-as-judge bench; evaluation is gates + human spot-check.

**Would ship:** Freeze ~20 hard pages (dense tables, dialogues, answer keys, rotated scans) as fidelity fixtures.

---

### Founder / scale

**What works:** Real shipped corpora (German 636 pages; French in progress), multi-language `--root` design, playbook distilled from real incidents (account switches, 529 storms, zero pages lost).

**Critique:** Throughput ceiling is Claude subscription windows, not software. No tenant model, no API, dual marketing sites with static KPIs. Choosing “craft factory forever” vs “productize the pipeline” is unresolved.

**Would ship:** Explicit product decision doc; until then optimize for operator leverage, not SaaS scaffolding.

---

## Agentic pattern — strengths vs theater

### Real agency

- Tool use (`rotate` / `zoom` / crop for content-filter)
- Adversarial role switch inside one prompt
- Repair-until-pass with re-verify from image
- Batch sizing for failure blast radius (~5–6 vision pages)
- Rolling concurrency with disk-gap resume

Tags: blackboard (disk), specialist roles, hard gates.

### Not really agentic (and that’s mostly fine)

- No planner graph in-repo
- No tool registry / memory beyond files
- No eval loop that proposes prompt changes
- No multi-agent debate
- No LangGraph / Crew / Swarm runtime

**Do not add agents for agents’ sake.** Highest-leverage upgrades are already written in ORCHESTRATION §5: text-layer first, tiered QA, right-size effort, one-pass enrich, Workflow when available. Encode those before introducing a framework.

---

## Cost snapshot (from internal docs)

Approximate token / usage-window share:

| Bucket | Share | Notes |
|---|---|---|
| Transcription (vision) | ~45% | Unavoidable for real scans |
| QA (re-read same image) | ~35% | Biggest “is it worth it?” cost |
| Repair | ~2% | Rare |
| Enrichment (text) | ~8% | Cheap on Sonnet/Haiku |
| Wasted re-runs | ~10% | Mid-write deaths — avoidable |
| Python | ~0% | Free |

Model policy (documented, not coded gateway):

- Vision (transcribe/QA/repair) → strong vision (Opus-class, high effort)
- Text enrich → cheaper (Sonnet / Haiku)
- Runs inside Claude subscription usage windows — not per-token API billing in this setup

---

## Recommended sequence

| Order | Move | Why personas agree |
|---|---|---|
| 1 | Default text-layer detect before vision | FinOps + SRE (less burn, fewer mid-write deaths) |
| 2 | Collapse to one PDF control plane (`_engine`) | Operator + Agentic (kill dual prompts / Workflow drift) |
| 3 | Tiered QA by `content_type` | FinOps without surrendering zero-loss on hard pages |
| 4 | Thin orchestrator CLI over disk gaps | SRE + onboarding (replayable runs) |
| 5 | Golden-page fidelity fixtures in CI | Eval + Product (catch prompt regressions) |
| 6 | Generate site metrics from exports | Product (dashboard stops lying) |

---

## Key file paths (for Claude Code)

**Docs / ops**

- `_engine/EXTRACTION-WORKFLOW.md`
- `_engine/PLAYBOOK.md`
- `_engine/README.md`
- `german/extracted/ORCHESTRATION-AND-MODELS.md`
- `_engine/HANDOFF-2026-07-28-pipelines-exports.md`

**Python engine**

- `_engine/_common.py` (explicitly: no job queue / gateway / telemetry)
- `_engine/pdf_to_images.py`
- `_engine/manifest_media.py`
- `_engine/merge_enrich.py`
- `_engine/reconcile.py`
- `_engine/verify_answers.py`
- `_engine/build_exports.py`
- `_engine/package_exports.py`

**Agent prompts**

- `_engine/agent_transcribe.md`
- `_engine/agent_enrich.md`
- `_engine/agent_vocab.md`
- `german/extracted/_tools/agent_*.md`
- `french/extracted/_tools/transcribe.workflow.js`
- `german/extracted/_tools/transcribe_pdf.workflow.js`

**Config**

- `french/extracted/_tools/collections.json`
- `german/extracted/_tools/collections.json`

**Web channel**

- `german/web/pipelines/extraction.pipeline.ts`
- `german/web/adapters/deutsch-pruefung.adapter.ts`

**Frontends**

- `site-next/lib/data.ts`
- `site/` (Netlify publish root per `netlify.toml`)

---

## How to use this with Claude Code

Paste or `@` this file and ask for one of:

1. Implement recommended move **#1** (text-layer detect as default Step 0).
2. Design the thin orchestrator CLI (move **#4**) against existing `reconcile` gap output.
3. Migration plan to collapse German / French legacy onto `_engine` (move **#2**).
4. Spec for golden-page CI fixtures (move **#5**).

Keep the invariant: **zero data loss wins over efficiency when they conflict.**
