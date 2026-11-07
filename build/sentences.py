"""Read the interlinear sentences in "kullilli sentences.docx" (a FLEx interlinear
export, edited in Word) into word-aligned records.

Each sentence in the document looks like this (tab-separated cells):

    193/1   ngathu  nhanha  galkarra  murnaanha          <- number, words
            ngathu  nhanha  galka  -rra  murna  -anha     <- morphemes
            ngathu  nhanha  galka  -rra1 murna2 -anha     <- dictionary entries (later texts only)
            1sg.erg 3sg.acc strike future snake accusative case   <- morpheme glosses
            pro     pro     v      v:Tense/Aspect n  n:Any         <- morpheme categories
            ...word glosses / word categories (later texts only)...
    Free I will kill the snake.
    Note ...

Long sentences wrap onto a second block of lines.  Word comments (questions)
are attached to the sentence they are anchored in.
"""
import re
import zipfile
import xml.etree.ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
# Category labels: used only to notice when a gloss line is missing.
POS_RE = re.compile(r"^(\*\*\*|pro|n|nn|v|vi|vt|adj|adv|advtra|part|num|dem|interj|intj|conj|prt|\d+|"
                    r"<.*>|\w+\s*[:>].*|attaches to any category)$", re.I)


def paragraphs(path):
    """[(style, text with tabs as '\\t', [comment ids])] for every paragraph."""
    z = zipfile.ZipFile(path)
    body = ET.fromstring(z.read("word/document.xml")).find(W + "body")
    out = []
    for p in body.iter(W + "p"):
        st = p.find(f"{W}pPr/{W}pStyle")
        parts = []
        for r in p.iter(W + "r"):
            for ch in r:
                if ch.tag == W + "t":
                    parts.append(ch.text or "")
                elif ch.tag == W + "tab":
                    parts.append("\t")
        out.append((st.get(W + "val") if st is not None else "", "".join(parts),
                    [c.get(W + "id") for c in p.iter(W + "commentRangeStart")]))
    comments = {}
    if "word/comments.xml" in z.namelist():
        for c in ET.fromstring(z.read("word/comments.xml")).iter(W + "comment"):
            comments[c.get(W + "id")] = re.sub(r"\s+", " ", "".join(t.text or "" for t in c.iter(W + "t"))).strip()
    return out, comments


def cells(line):
    return [c.strip() for c in line.split("\t") if c.strip()]


def is_pos(tokens):
    return tokens and sum(bool(POS_RE.match(t)) for t in tokens) >= 0.8 * len(tokens)


def base(tok):
    return re.sub(r"\d+$", "", tok).lower()


def is_entry_line(tokens, morphs):
    """The 'dictionary entry' line repeats the morphemes, sometimes with homograph numbers."""
    toks = [t for t in tokens if not t.startswith("+")]
    if not toks or not morphs:
        return False
    same = sum(base(a) == b.lower() or a == "***" for a, b in zip(toks, morphs))
    return same >= 0.6 * max(len(toks), len(morphs))


def split_tiers(lines, rich):
    """Assign the tab lines of one sentence to tiers by their order:
    morphemes, [entries], glosses, categories, [word glosses, word categories];
    a further line after the last tier starts the next block of a wrapped sentence."""
    bundles, cur, stage = [], None, "done"
    for line in lines:
        toks = cells(line)
        if not toks:
            continue
        if stage == "done":
            cur, stage = {"morph": toks}, "morph"
            bundles.append(cur)
        elif stage == "morph" and rich and is_entry_line(toks, cur["morph"]):
            cur["entry"], stage = [t for t in toks if not t.startswith("+")], "entry"
        elif stage in ("morph", "entry"):
            stage = "pos" if is_pos(toks) else "gloss"          # a missing gloss line
            cur[stage] = toks
            if stage == "pos" and not rich:
                stage = "done"
        elif stage == "gloss":
            cur["pos"], stage = toks, ("pos" if rich else "done")
        elif stage == "pos":                                    # rich texts only
            stage = "wpos" if is_pos(toks) else "wgloss"
            cur[stage] = toks
            if stage == "wpos":
                stage = "done"
        elif stage == "wgloss":
            cur["wpos"], stage = toks, "done"
    return bundles


def group_words(words, morphs):
    """Split the morpheme list into words, guided by the surface words."""
    norm = lambda s: re.sub(r"[-=\s]", "", s.lower())
    groups, i = [], 0
    for w in words:
        target, acc, g = norm(w), "", []
        while i < len(morphs) and (not g or (target.startswith(acc + norm(morphs[i])) and acc != target)):
            g.append(i)
            acc += norm(morphs[i])
            i += 1
            if acc == target:
                break
        groups.append(g)
    if i == len(morphs) and all(groups):
        return groups
    groups = []                                    # fall back: suffixes join the preceding morpheme
    for k, m in enumerate(morphs):
        if groups and m.startswith(("-", "=")):
            groups[-1].append(k)
        else:
            groups.append([k])
    return groups


def parse(path):
    paras, comments = paragraphs(path)
    sents, text, cur, story_n = [], None, None, 0
    for style, t, cids in paras:
        if style.lower().startswith("heading"):
            text, cur, story_n = t.strip(), None, 0
            continue
        if text is None or not t.strip():
            continue
        numbered = re.match(r"^(\d+(?:/\d+)?)\t(.*)$", t)
        if t.startswith("Free"):
            if cur:
                cur["ft"].append(t[4:].strip())
        elif t.startswith("Note"):
            if cur:
                cur["notes"].append(re.sub(r"^Note\s*", "", t).strip())
        elif numbered or ("\t" in t and not t.startswith("\t") and (cur is None or cur["ft"])):
            if numbered:
                ref, rest = numbered.group(1), numbered.group(2)
            else:
                story_n += 1
                ref, rest = str(story_n), t
            cur = {"text": text, "ref": ref, "words": [w for w in cells(rest)], "lines": [],
                   "ft": [], "notes": [], "comments": []}
            sents.append(cur)
        elif "\t" in t and cur is not None:
            cur["lines"].append(t)                 # tier line (some lost their leading tab)
        if cur is not None:
            cur["comments"] += [comments[c] for c in cids if comments.get(c)]

    rich_texts = {s["text"] for s in sents if len(s["lines"]) >= 5}
    for s in sents:
        bundles = split_tiers(s.pop("lines"), s["text"] in rich_texts)
        tiers = {k: sum((b.get(k, []) if len(b.get(k, [])) == len(b["morph"]) else [None] * len(b["morph"])
                         for b in bundles), []) for k in ("gloss", "pos", "entry")}
        morphs = sum((b["morph"] for b in bundles), [])
        s["aligned"] = all(len(b.get("gloss", [])) == len(b["morph"]) for b in bundles)
        s["morphs"] = [{"f": m, "g": tiers["gloss"][k] or "", "ps": tiers["pos"][k] or "",
                        "e": tiers["entry"][k] or ""} for k, m in enumerate(morphs)]
        s["line"] = " ".join(s["words"])               # the sentence as written
        words = [w for w in s["words"] if w not in ("/", "//")]
        s["groups"] = group_words(words, morphs)
        s["words"] = words if len(words) == len(s["groups"]) else \
            ["".join(morphs[k].lstrip("-=") for k in g) for g in s["groups"]]
    return sents


if __name__ == "__main__":
    import sys
    from collections import Counter
    S = parse(sys.argv[1])
    print(len(S), "sentences;", Counter(s["text"] for s in S))
    print("aligned glosses:", sum(s["aligned"] for s in S), "| with entry line:",
          sum(any(m["e"] for m in s["morphs"]) for s in S), "| no translation:", sum(not s["ft"] for s in S))
    for s in S[:2] + S[200:201]:
        print(s)
