# Lessons learned (reference session, 2026-11-24: "Is Polish the best language for LLMs?")

| # | What happened | Cost | Do this instead |
|---|---|---|---|
| 1 | The request arrived in three pieces (interrupts plus pasted additions); the first agent launch was rejected | A restart and resent briefs | Restate the full brief and get a yes, or use plan mode, before launching anything |
| 2 | The national-language and 5-iteration requirements were sent as an addendum after launch; A2 finished without them | One extra agent round | Put national-language search and ≥5 iterations in every brief from the start |
| 3 | The brief stated a guessed hypothesis and a wrong author list for BEIR-PL | Risk of anchoring agents on a wrong fact; a verifier had to correct it | Phrase specifics as "hypothesis to verify"; never give them as facts |
| 4 | Subagents had no Bash, so PDF tables were read through a summarizing fetch; Semantic Scholar returned 429/403 | Lower confidence; the full per-language table was never recovered | Pre-allow `curl`/`pdftotext`, or download and convert key PDFs yourself and hand verifiers the text |
| 5 | A verifier refused to write its scratchpad file, citing a generic "no report .md" rule | Its report existed only in the message | State in every brief that writing the scratchpad report file is allowed and expected |
| 6 | Verifiers were launched ad hoc, as doubts appeared (5 in total) | Fine, but sequential | Plan Phase 3 up front: one verifier for the headline numbers, plus one per area with a parallel comparison |
| 7 | Contradiction (A1 "primary" vs A4 "press only" for the 88/83.9 figures) | Resolved by a third extraction | Count independent confirmations explicitly and record them in the report |
| 8 | The artifact overflowed at phone width (claim cards in a grid without `minmax(0,1fr)`) | One fix and rebuild | Use the template CSS; check `scrollWidth` once |
| 9 | No Markdown converter on the VM; the hand-written converter mishandled `***` (bold with nested italic) | One debugging round | Use the bundled `scripts/md2html.py`, which is fixed |
| 10 | The user asked for HTML and PDF versions only afterwards | Extra turns | Offer MD + HTML + artifacts by default, and ask about PDF in the preflight |
| 11 | Session started on `main`; I picked a `docs/` branch, but the user wanted `feat/` | A branch rename | Use `feat/<topic>` (the user's convention) |
| 12 | `git commit` failed because no identity was set; push failed with 403 (fine-grained PAT without Contents: write) | Two interruptions | Run the git preflight in Phase 0 and report problems before the work starts |
| 13 | The headline result had no significance test, and per-language values existed only in figures | Could not chart the full ranking | Say so plainly; never estimate values from charts |

## What worked and should be kept

- One agent dedicated to the original source plus the media chain. It found the authors' public clarifications and the numbers the press invented.
- Asking verifiers to fill gaps, not only to confirm. This produced BEIR-PL (the only same-item PL vs EN retrieval data) and MASSIVE-Agents (Polish agent data).
- Asking for chart-ready tables in every agent report made building the artifact mechanical.
- Status labels and an "Apples-to-apples?" column kept the synthesis honest.
