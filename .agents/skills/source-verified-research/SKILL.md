---
name: source-verified-research
description: Multi-agent, source-verified research on a claim, article or question, run by a coordinator that delegates searching to cheap subagents (Haiku), cross-checks every number against primary sources, and delivers a bilingual (PL + EN) Markdown/HTML/PDF report plus interactive chart artifacts, then commits them on a feature branch. Use this whenever the user asks to fact-check an article or media claim, "find the original source/report", gather the latest data or benchmarks on a topic, compare evidence across languages or countries, delegate research to several subagents, or produce a research report with charts — even if they do not say "skill" or "research workflow". Especially relevant for questions about LLM benchmarks, language effects, and Polish/Slavic data.
---

# Source-verified research

You are the **coordinator**. Your job is to manage the process, check quality, validate, give feedback and write the final synthesis. Subagents do the searching and reading. When in doubt about any fact, delegate a confirmation to another agent instead of guessing.

The user's working language is Polish: talk to them in Polish. Repository documents follow `AGENTS.md` (English by default), and the final deliverables are produced in **both Polish and English** unless the user says otherwise.

## Why it is built this way

- Media articles routinely distort studies (scope widened, causes invented, numbers copied from other articles). Only numbers read from the primary document (paper table, figure caption, dataset, official leaderboard, vendor system card) count as evidence. Everything else is a lead.
- Cheap models read a lot, but they sometimes misread tables or confuse versions. That is why every important number needs a second, independent extraction.
- Research in English alone misses national sources. Polish and other Slavic benchmarks are often published in national venues and languages.

## Phase 0: preflight (do this before launching anything)

Problems found late in a session cost the most time, so check these first:

1. **Restate the brief** to the user in 5-8 bullets: the claim or question, scope, languages, number of agents, deliverables (formats and languages), and where files and the commit will go. If the request is long or was pasted in pieces, use plan mode or ask one short confirmation question before launching agents. Agents that were already launched cannot easily absorb new requirements.
2. **Git readiness** (only if a commit is expected): run `git branch --show-current`, `git remote -v`, `gh repo view --json isFork,parent`, `git config user.email` and `gh auth status`. If on `main`, plan a `feat/<topic>` branch. This user prefers the `feat/` prefix, so do not invent `docs/`. If the git identity is missing, ask before setting it (repo-local is the sensible default). Pushing can still fail with 403 when a fine-grained PAT lacks *Contents: write*. Do not try to work around that; tell the user which token permission to change.
3. **Tooling for subagents**: subagents may be denied Bash (curl, pdftotext). Then they can only read PDFs through a summarizing fetch, which lowers confidence. Either ask the user to allow `curl` / `pdftotext` up front, or plan to download key PDFs yourself (`curl -L -o <scratchpad>/pdf/<id>.pdf`, then `pdftotext -layout`, run in an isolated directory) and pass the text paths to verifiers.

## Phase 1: research fan-out (≥ 5 agents, in parallel)

Launch all research agents **in one message**, each with `model: "haiku"`, `subagent_type: "general-purpose"` and `run_in_background: true`. Split the scope so the agents do not overlap. For a typical "is claim X true, and what does newer data say" task:

| Agent | Scope |
|---|---|
| A1 | The original source: the article, the paper behind it, the exact numbers and their location, the authors' limitations, and how the media distorted it |
| A2..An | One evidence area each (e.g. long-context, retrieval/RAG, reasoning, native-language benchmarks, agents/tool use, cost/tokenization) |

Write each brief with the template in `references/briefs.md`. A good brief contains:
- the whole project context, so every agent understands the goal;
- its own scope, with **example sources, repositories and search phrases**;
- **national-language search and at least 5 documented iterations** from the start. Do not add these later as an addendum; in the reference session one agent finished before the addendum arrived and had to be resent;
- verification rules and the exact report format, including the file path in the scratchpad.

Do not put unverified specifics into a brief as facts (paper authors, numbers, the identity of the source). Phrase them as "hypothesis to verify". In the reference session a guessed author list in a brief was wrong, and only a verifier caught it.

Tell the agents explicitly that writing their report file to the scratchpad path **is allowed and expected**. One verifier refused to write a `.md` file because of a generic rule.

## Phase 2: review each report as it arrives

For every hand-back, check:
- each number has a value, a metric, what exactly was measured, a table or figure location, a URL and a status (VERIFIED-primary / UNVERIFIED / CONTRADICTED);
- the search log has at least 5 iterations, including national languages; if it is missing, send the agent back with `SendMessage`;
- plausibility: a value that contradicts the paper's own thesis, the same value repeated across rows, different numbers in two tables of the same paper, or an author list that differs from the brief;
- contradictions between agents (one says "primary", another says "press only").

Reply to an agent with concrete feedback when something is missing. Do not fix it silently yourself.

## Phase 3: targeted verification (delegate doubts)

For every important doubt, launch a **verifier agent** (Haiku) with a narrow checklist: "confirm or correct values X, Y, Z in Table N of paper P, and fill gap G". Typical verifier jobs:
- the headline numbers of the original source (independent re-extraction);
- the per-category or per-language table, if the original reports one;
- the most promising parallel (same-item) comparison found by any agent;
- suspicious table rows (exact row labels).

Verifiers also hunt for the gaps you notice yourself (for example, "dataset X is a translation of an English benchmark, so check whether the paper reports both languages"). This found the best Polish-vs-English retrieval evidence in the reference session.

Do the trivial arithmetic yourself (averages, ratios) with a one-line Python check, and record it as derived.

## Phase 4: synthesis and deliverables

Write the final report yourself, from the agent files in the scratchpad. Structure and rules: `references/report-and-artifact.md`. Deliver all of these by default, because the user asked for every one of them in the reference session:

1. `docs/research/<slug>.en.md` and `docs/research/<slug>.pl.md`;
2. `docs/research/<slug>.en.html` and `.pl.html`, via `scripts/md2html.py` (no pandoc on the course VMs);
3. a PDF, if the user asks for one, via `bash scripts/md2pdf.sh` (headless Chrome);
4. two interactive artifacts (PL and EN) built from one template with a `LANG` switch. See `docs/research/artifact/template.html` (in the repo, from the reference session) for a finished example (claim checker, toggles, dumbbell and bar charts, a token calculator, data tables, a confidence matrix). Load the `dataviz` skill before writing chart code, and use the Artifact tool's quickstart for the page contract.

Mark confidence honestly. Single-extraction values and internally inconsistent sources are labelled "lower confidence". Values that exist only in figures are never estimated.

## Phase 5: QA, commit, push

- Verify the HTML: tags balanced, no leftover Markdown asterisks in the text, no horizontal overflow at phone width (`document.documentElement.scrollWidth === clientWidth`), and no console errors. One browser look is enough.
- Commit only the named paths (never `git add -A`), on a `feat/<topic>` branch, using the format `Docs: …` plus the attribution trailer. Push only when the user asks.
- If the user wants a PR, offer `gh pr create`. Never push to `main`.

## Phase 6: wrap-up message (in Polish)

Give the direct answer first, then the key evidence, what was not found, the files and artifact links, the process (agents, iterations, what the verification caught), and 2-3 concrete tips for working better with Claude Code next time.

Known pitfalls from the reference session are listed in `references/lessons-learned.md`. Read it once before Phase 1.
