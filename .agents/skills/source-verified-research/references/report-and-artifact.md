# Report and artifact structure

## Markdown report (one per language, same structure)

```
# <Question as title>
Research date · Method (N research + M verification agents, model) · link to the other language

## TL;DR                    (numbered: source, what it measured, replication, main evidence, bottom line)
## 1. Tracing the source    (table: Item | Finding | Status) + "How the media changed the claim" (claim | what the paper says)
## 2..k. Evidence areas     (one section per agent area; tables with Comparable? column; one bold takeaway each)
## k+1. Practical recommendations
## k+2. Gaps and limitations (search breadth, fetch method, single-extraction values, items not covered)
## Sources (primary)        (inline links)   + Secondary (leads only)
```

Rules:
- Every number in the report appears in a verified agent or verifier file. Derived values (averages, ratios) are labelled as derived.
- Status words: Verified / Verified (primary) / Not verifiable / Not in paper / Lower confidence.
- Separate "our hypothesis" from the sources' claims, and label it as untested.
- The Polish file is a translation of the English one, not a shortened version. Keep the tables identical and use decimal commas in Polish.
- Wording style: short, direct sentences. Avoid "not X but Y" and em-dash asides.

## HTML and PDF

```bash
python3 -I .agents/skills/source-verified-research/scripts/md2html.py docs/research/<slug>.en.md docs/research/<slug>.en.html en
bash .agents/skills/source-verified-research/scripts/md2pdf.sh docs/research/<slug>.en.md   # → .html + .pdf
```

The converter handles headings (with slug ids), nested lists, pipe tables, bold/italic/code, and links (`.md` → `.html`). Check the result: zero tag errors, no `*` left in the text.

## Interactive artifact

Use `docs/research/artifact/template.html` (committed in the repo) as the pattern. It is a finished page from the reference session; replace the `S` (strings) and `D` (data) objects.

- Single source file, `const LANG="__LANG__"`, `<title>__TITLE__</title>`. Build both variants:
  ```bash
  sed -e 's/__LANG__/pl/' -e 's/__TITLE__/<PL name>/' template.html > <slug>.pl.html
  sed -e 's/__LANG__/en/' -e 's/__TITLE__/<EN name>/' template.html > <slug>.en.html
  ```
- Sections: hero with 3–4 verdict tiles → claim checker (expandable media claims with status chips) → one section per evidence area (chart + "Show data as a table" + takeaway note) → verdict matrix with confidence → recommendations → method and sources.
- Charts: inline SVG, color by entity (EN blue, PL orange, others grey), a hover/focus tooltip on every mark, a data table for each chart, and one interactive concept tool (for example a token or context calculator).
- Grid children that contain text need `minmax(0,1fr)` or `min-width:0`. The first build in the reference session overflowed at phone width because of this.
- Run `node --check` on the extracted `<script>`, take one browser look (overflow, console), then publish both files with `Artifact` (`icon: "chart"`) and a one-sentence description.
