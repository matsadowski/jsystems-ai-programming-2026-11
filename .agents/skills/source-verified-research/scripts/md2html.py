"""Minimal Markdown -> standalone HTML converter for research reports (no pandoc needed).
Supports: headings (with slug ids), paragraphs, nested bullet/ordered lists,
pipe tables, ``` fenced code blocks, hr, **bold** (with nested *italic*), *italic*, `code`, [links](url) (.md -> .html).
Includes light/dark themes and print styles for PDF export.
Usage: python3 -I md2html.py <src.md> <dst.html> <lang>"""
import html, re, sys, unicodedata

def slug(text):
    t = unicodedata.normalize("NFKD", re.sub(r"<[^>]+>", "", text)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")

def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    def link(m):
        url = re.sub(r"\.md(#|$)", r".html\1", m.group(2))
        ext = ' target="_blank" rel="noopener"' if url.startswith("http") else ""
        return f'<a href="{html.escape(url)}"{ext}>{m.group(1)}</a>'
    s = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", link, s)
    # bold may contain a nested *italic* span (e.g. "**Author, *Title***")
    s = re.sub(r"\*\*((?:[^*]|\*[^*]+\*)+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\*\w])\*(?!\s)(.+?)(?<!\s)\*(?![\*\w])", r"<em>\1</em>", s)
    return s

def render_list(items):
    """items: [(indent, tag, text)] -> nested <ul>/<ol>; children have larger indent."""
    ind, tag = items[0][0], items[0][1]
    html_out, j = [f"<{tag}>"], 0
    while j < len(items):
        _, _, text = items[j]; j += 1
        k = j
        while k < len(items) and items[k][0] > ind: k += 1
        child = render_list(items[j:k]) if k > j else ""
        html_out.append(f"<li>{inline(text)}{child}</li>"); j = k
    return "".join(html_out) + f"</{tag}>"

def convert(md):
    lines, out, i = md.split("\n"), [], 0
    para = []
    def flush():
        if para:
            out.append(f"<p>{inline(' '.join(para))}</p>")
            para.clear()
    while i < len(lines):
        ln = lines[i]
        if not ln.strip():
            flush(); i += 1; continue
        if ln.lstrip().startswith("```"):
            flush(); i += 1; code = []
            while i < len(lines) and not lines[i].lstrip().startswith("```"):
                code.append(html.escape(lines[i], quote=False)); i += 1
            out.append("<pre><code>" + "\n".join(code) + "</code></pre>"); i += 1; continue
        m = re.match(r"^(#{1,6})\s+(.*)$", ln)
        if m:
            flush(); lvl, txt = len(m.group(1)), m.group(2)
            out.append(f'<h{lvl} id="{slug(txt)}">{inline(txt)}</h{lvl}>'); i += 1; continue
        if re.match(r"^-{3,}\s*$", ln):
            flush(); out.append("<hr>"); i += 1; continue
        if ln.lstrip().startswith("|"):
            flush(); rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            head, body = rows[0], [r for r in rows[1:] if not all(re.match(r"^:?-+:?$", c) for c in r)]
            num = lambda c: bool(re.match(r"^[\*\+−\-]*[\d.,]+(\s?(pp|%|×))?\**$", c))
            out.append('<div class="tbl"><table><thead><tr>' + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>")
            for r in body:
                out.append("<tr>" + "".join(f'<td{" class=n" if num(c) else ""}>{inline(c)}</td>' for c in r) + "</tr>")
            out.append("</tbody></table></div>"); continue
        if re.match(r"^\s*([-*]|\d+\.)\s+", ln):
            flush(); items = []
            while i < len(lines) and re.match(r"^\s*([-*]|\d+\.)\s+", lines[i]):
                m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", lines[i])
                items.append((len(m.group(1)), "ol" if m.group(2)[0].isdigit() else "ul", m.group(3))); i += 1
            out.append(render_list(items)); continue
        para.append(ln.strip()); i += 1
    flush()
    return "\n".join(out)

CSS = """
:root{--bg:#f4f6f8;--surface:#fcfcfb;--ink:#12171e;--ink-2:#4a525d;--muted:#7c838c;--rule:#dde2e8;--accent:#1f4fa8;--accent-soft:#e4ecf8;
--serif:"IBM Plex Serif",Georgia,serif;--sans:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1318;--surface:#171b21;--ink:#eef1f4;--ink-2:#b9c0c8;--muted:#8a929b;--rule:#2a3038;--accent:#8db4ff;--accent-soft:#1c2a42;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0f1318;--surface:#171b21;--ink:#eef1f4;--ink-2:#b9c0c8;--muted:#8a929b;--rule:#2a3038;--accent:#8db4ff;--accent-soft:#1c2a42;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6;padding-inline:16px;padding-block:32px 64px}
main{max-width:860px;margin:0 auto}
h1,h2,h3{font-family:var(--serif);font-weight:600;line-height:1.2;text-wrap:balance}
h1{font-size:clamp(26px,4.5vw,38px);margin:0 0 12px}
h2{font-size:clamp(21px,3vw,27px);margin:40px 0 12px;padding-top:8px}
h3{font-size:18px;margin:28px 0 8px}
p,li{max-width:72ch}
p{margin:0 0 14px}
ul,ol{padding-left:22px;margin:0 0 14px}
li{margin-bottom:6px}
li>ul,li>ol{margin:6px 0 0}
a{color:var(--accent)}
code{font-family:var(--mono);font-size:.9em;background:var(--accent-soft);padding:1px 5px;border-radius:4px}
hr{border:0;border-top:1px solid var(--rule);margin:36px 0}
pre{background:var(--surface);border:1px solid var(--rule);border-radius:8px;padding:12px 14px;overflow-x:auto;margin:0 0 16px}
pre code{background:none;padding:0;font-size:13px;line-height:1.5;white-space:pre}
strong{font-weight:600}
.tbl{overflow-x:auto;margin:8px 0 18px;background:var(--surface);border:1px solid var(--rule);border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--rule);vertical-align:top}
tr:last-child td{border-bottom:0}
th{font-weight:600;color:var(--ink-2);white-space:nowrap}
td.n{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
main>p:first-of-type{font-family:var(--mono);font-size:13px;color:var(--muted)}
@media print{
:root,:root:not([data-theme="light"]){--bg:#fff;--surface:#fff;--ink:#000;--ink-2:#333;--muted:#555;--rule:#ccc;--accent:#1f4fa8;--accent-soft:#eef2f8;color-scheme:light}
body{padding:0;font-size:10.5pt}main{max-width:none}
h1{font-size:22pt}h2{font-size:15pt;margin-top:22px;break-after:avoid}h3{font-size:12pt;break-after:avoid}
p,li{max-width:none}.tbl{overflow:visible;border:1px solid var(--rule)}table{font-size:9pt}th,td{padding:4px 7px}
th{white-space:normal}tr,li,pre{break-inside:avoid}pre code{white-space:pre-wrap;font-size:8.5pt}@page{margin:15mm 14mm}}
"""

def page(md, lang):
    title = re.search(r"^#\s+(.*)$", md, re.M).group(1)
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Serif:wght@600&display=swap">
<style>{CSS}</style>
</head>
<body>
<main>
{convert(md)}
</main>
</body>
</html>
"""

if __name__ == "__main__":
    src, dst, lang = sys.argv[1:4]
    open(dst, "w", encoding="utf-8").write(page(open(src, encoding="utf-8").read(), lang))
