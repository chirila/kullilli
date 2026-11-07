#!/usr/bin/env python3
"""Build the short lessons page from the lesson texts.

    cd kullilli && python3 build/build_lessons.py

Reads lessons/*.md (one file per unit, taken in file-name order; the format is described in
lessons/README.md) and writes docs/lessons/lessons-data.js (window.LESSONS). It also stamps a
content fingerprint on the page's scripts and stylesheets (lessons.js?v=1a2b3c4d) so browsers
fetch new copies after an update.

Stops with a message if an example's Kullilli and English lines have different numbers of words,
a lesson has no id, or two lessons share an id. Prints a warning if a word and its gloss are split
into different numbers of parts by hyphens.
"""
import hashlib
import html
import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "lessons"
OUT = ROOT / "docs" / "lessons"
LANG_CODE = "gll"          # Kullilli text is marked lang="gll" (as on the dictionary pages)

TITLE = "Kullilli lessons"
CREDIT = ("Based on the Kullilli Sketch Grammar (first edition, 2023) by Juhyae Kim, Irene Yi, Sam Lopez, "
          "Alida Scheffers, Jeremiah Jewell, Coralie Cram, Claire Bowern and Toby Adams.")

problems, warnings = [], []


def kspan(text):
    return f'<span class="k" lang="{LANG_CODE}" translate="no">{text}</span>'


def inline(text):
    """{word} = Kullilli, **bold**, *italic*."""
    t = html.escape(text.strip(), quote=False)
    t = re.sub(r"\{([^{}]+)\}", lambda m: kspan(m.group(1)), t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
    return t


def quoted(text):
    text = text.strip().strip("‘’'\"“”")
    return f"‘{inline(text)}’"


def example(opts, lines, where):
    """```ex [ref] [made-up] [part]: Kullilli / gloss / translation [/ lit: literal translation]"""
    if len(lines) < 3:
        problems.append(f"{where}: an example needs three lines (Kullilli, gloss, translation)")
        return ""
    words, glosses = lines[0].split(), lines[1].split()
    if len(words) != len(glosses):
        problems.append(f"{where}: {len(words)} Kullilli words but {len(glosses)} glosses in “{lines[0]}”")
        return ""
    for w, g in zip(words, glosses):
        if w.count("-") != g.count("-"):
            warnings.append(f"{where}: “{w}” / “{g}” have different numbers of parts")
    cols = "".join(
        f'<span class="w">{kspan(html.escape(w))}<span class="g">{html.escape(g)}</span></span>'
        for w, g in zip(words, glosses))
    out = [f'<figure class="ex"><div class="igt">{cols}</div>',
           f'<figcaption class="tr">{quoted(lines[2])}</figcaption>']
    for extra in lines[3:]:
        if extra.lower().startswith("lit:"):
            out.append(f'<p class="lit">Literally: {quoted(extra[4:])}</p>')
        else:
            out.append(f'<p class="exnote">{inline(extra)}</p>')
    notes = []
    for o in opts:
        if re.fullmatch(r"\d+(/\d+)?", o):
            notes.append(f"Recorded sentence {o}")
        elif o == "made-up":
            notes.append("Made up by the guide’s authors")
        elif o == "part":
            notes.append("Part of a longer sentence")
        else:
            problems.append(f"{where}: unknown example label “{o}”")
    if notes:
        out.append(f'<p class="src">{" · ".join(notes)}</p>')
    return "".join(out) + "</figure>"


def wordlist(lines, where):
    """```words: one ‘Kullilli | meaning’ per line"""
    items = []
    for ln in lines:
        if "|" not in ln:
            problems.append(f"{where}: word list line without “|”: {ln}")
            continue
        v, g = (x.strip() for x in ln.split("|", 1))
        items.append(f'<li>{kspan(html.escape(v))} <span class="gl">{quoted(g)}</span></li>')
    return f'<ul class="words">{"".join(items)}</ul>'


def table(lines):
    rows = [[c.strip() for c in ln.strip().strip("|").split("|")] for ln in lines]
    rows = [r for r in rows if not all(re.fullmatch(r":?-+:?", c) for c in r)]
    head, body = rows[0], rows[1:]
    th = "".join(f"<th>{inline(c)}</th>" for c in head)
    trs = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body)
    return f'<div class="tbl"><table><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table></div>'


def body_html(lines, where):
    """Turn a lesson's text (without its Q/A lines) into HTML."""
    out, i = [], 0
    while i < len(lines):
        ln = lines[i]
        if not ln.strip():
            i += 1
        elif ln.startswith("```"):
            kind, *opts = ln[3:].split()
            j = i + 1
            while j < len(lines) and not lines[j].startswith("```"):
                j += 1
            block = [x.strip() for x in lines[i + 1:j] if x.strip()]
            out.append(example(opts, block, where) if kind == "ex" else wordlist(block, where))
            i = j + 1
        elif ln.startswith("|"):
            j = i
            while j < len(lines) and lines[j].startswith("|"):
                j += 1
            out.append(table(lines[i:j]))
            i = j
        elif ln.startswith("- "):
            items = []
            while i < len(lines) and (lines[i].startswith("- ") or (lines[i].startswith("  ") and items)):
                if lines[i].startswith("- "):
                    items.append(lines[i][2:])
                else:
                    items[-1] += " " + lines[i].strip()
                i += 1
            out.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ul>")
        elif ln.startswith(">"):
            para = []
            while i < len(lines) and lines[i].startswith(">"):
                para.append(lines[i][1:].strip())
                i += 1
            out.append(f'<aside class="note"><p>{inline(" ".join(para))}</p></aside>')
        else:
            para = []
            while i < len(lines) and lines[i].strip() and not lines[i].startswith(("```", "|", "- ", ">")):
                para.append(lines[i])
                i += 1
            out.append(f"<p>{inline(' '.join(para))}</p>")
    return "".join(out)


def split_qa(lines, where):
    """Q:/A: lines (an answer may run on over several lines) → [[q, a], ...]; the rest is the text."""
    text, qa, cur = [], [], None
    for ln in lines:
        if ln.startswith("Q:"):
            qa.append([ln[2:].strip(), ""])
            cur = 0
        elif ln.startswith("A:"):
            if not qa or qa[-1][1]:
                problems.append(f"{where}: answer without a question: {ln}")
                continue
            qa[-1][1] = ln[2:].strip()
            cur = 1
        elif cur is not None and ln.strip():
            qa[-1][cur] += " " + ln.strip()
        else:
            cur = None
            text.append(ln)
    for q, a in qa:
        if not a:
            problems.append(f"{where}: question without an answer: {q}")
    return text, [[inline(q), inline(a)] for q, a in qa]


def parse_unit(path, n):
    lines = path.read_text(encoding="utf-8").splitlines()
    unit = {"n": n, "title": "", "intro": "", "lessons": []}
    chunks, cur = [], None
    for ln in lines:
        if ln.startswith("# "):
            unit["title"] = ln[2:].strip()
            cur = intro = []
        elif ln.startswith("## "):
            cur = [ln[3:].strip()]
            chunks.append(cur)
        elif cur is not None:
            cur.append(ln)
    unit["intro"] = body_html(intro, path.name) if unit["title"] else ""
    for k, (title, *rest) in enumerate(chunks, 1):
        meta = {}
        while rest and re.match(r"^(id|grammar):", rest[0]):
            key, val = rest.pop(0).split(":", 1)
            meta[key] = val.strip()
        where = f"{path.name} › {title}"
        if not meta.get("id"):
            problems.append(f"{where}: no id")
        text, qa = split_qa(rest, where)
        unit["lessons"].append({
            "id": meta.get("id", ""), "n": f"{n}.{k}", "title": inline(title),
            "grammar": inline(meta.get("grammar", "")), "html": body_html(text, where), "qa": qa,
        })
    return unit


def stamp(page):
    """Add a content fingerprint to each local script/stylesheet link on the page."""
    text = page.read_text(encoding="utf-8")

    def fp(m):
        f = (page.parent / m.group(2)).resolve()
        return f'{m.group(1)}{m.group(2)}?v={hashlib.md5(f.read_bytes()).hexdigest()[:8]}"' if f.exists() else m.group(0)
    text = re.sub(r'((?:src|href)=")([\w./-]+\.(?:js|css))(?:\?v=\w+)?"', fp, text)
    page.write_text(text, encoding="utf-8")


def main():
    files = sorted(SRC.glob("[0-9]*.md"))
    units = [parse_unit(p, n) for n, p in enumerate(files, 1)]
    ids = [l["id"] for u in units for l in u["lessons"]]
    for i in sorted({x for x in ids if ids.count(x) > 1}):
        problems.append(f"lesson id used twice: {i}")
    for w in warnings:
        print("warning:", w)
    if problems:
        print("\n".join(problems))
        sys.exit("Not written: fix the lines above first.")
    data = {"title": TITLE, "credit": CREDIT, "units": units}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "lessons-data.js").write_text(
        "window.LESSONS = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    if (OUT / "index.html").exists():
        stamp(OUT / "index.html")
    n_ex = sum(l["html"].count('class="ex"') for u in units for l in u["lessons"])
    n_qa = sum(len(l["qa"]) for u in units for l in u["lessons"])
    print(f"{len(units)} units, {len(ids)} lessons, {n_ex} examples, {n_qa} review questions → {OUT / 'lessons-data.js'}")


if __name__ == "__main__":
    main()
