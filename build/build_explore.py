#!/usr/bin/env python3
"""Build the data for the Explore pages (docs/explore/): figures about the dictionary, minimal pairs, and the
links between words for the word web.

    cd kullilli && python3 build/build_lift.py ../KullilliDictionary    # first, so the dictionary data is current
    python3 build/build_explore.py

Reads docs/data/dictionary.js and the WordNet 3.1 files in ../Wordnet_dict, and writes
docs/explore/explore-data.js (window.EXPLORE).  It also stamps a content fingerprint on the page's
scripts and stylesheets (explore.js?v=1a2b3c4d) so browsers fetch new copies after an update.

What is worked out here:
  stats   counts shown on "In numbers": entries, recordings, kinds of word, topics, word length, sounds
  pairs   minimal pairs: two headwords that differ in one sound (dh, ng, rr … count as one sound).
          Affixes, phrases and words that are variants of each other are left out.  The network layout is
          worked out here too, so the page only has to draw it.
  links   for each entry, related entries:
            x  the dictionary's own links (See also, Used in, Made from, Minimal pair, Variant of …)
            s  same meaning: the same English gloss, or glosses that WordNet puts in one sense
            o  opposite meaning (WordNet antonyms)
            b/n broader / narrower meaning: the nearest broader sense (WordNet hypernyms, up to 3 steps)
                that another entry is glossed with, e.g. emu -> bird (commonest senses only: a second
                sense made bird a kind of meat)
            P/W has as a part / is part of (WordNet part, member and substance links), e.g. hand -> finger
          WordNet links are only made for nouns, verbs, adjectives and adverbs, using the commonest senses of
          each gloss in the word's own part of speech (WordNet lists them first): two for nouns, adjectives and
          adverbs, one for verbs.
"""
import hashlib
import itertools
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import networkx as nx                  # noqa: E402
import suggest                         # noqa: E402  (its WordNet reader and gloss cleaning)

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
OUT = DOCS / "explore"
WORDNET = ROOT.parent / "Wordnet_dict"

WN_POS = {"noun": "noun", "verb": "verb", "adjective": "adj", "adverb": "adv"}
SENSES = 2          # commonest WordNet senses used per gloss (verbs: 1; their second senses mostly add "a kind of move")
UP = 3              # how many steps up WordNet's broader senses to look for another entry
CLASS_NAMES = {"noun": "Nouns", "verb": "Verbs", "adjective": "Adjectives", "adverb": "Adverbs",
               "pronoun": "Pronouns & question words", "suffix": "Suffixes", "prefix": "Prefixes",
               "clitic": "Clitics", "phrase": "Phrases", "interjection": "Interjections", "place": "Place names",
               "other": "Other"}
DDP_TOP = {"1": "Universe, creation", "2": "Person", "3": "Language and thought", "4": "Social behaviour",
           "5": "Daily life", "6": "Work and occupation", "7": "Physical actions", "8": "States", "9": "Grammar"}


def load():
    s = (DOCS / "data" / "dictionary.js").read_text(encoding="utf-8")
    return json.loads(s[s.index("{"):s.rindex("}") + 1])


def tokenizer(data):
    units = sorted({u for row in data["keyboard"] for u in row}, key=len, reverse=True)

    def tok(w):
        out, i = [], 0
        while i < len(w):
            u = next((u for u in units if w.startswith(u, i)), None)
            if u is None:
                return None
            out.append(u)
            i += len(u)
        return out
    return tok


def is_word(c):
    """a whole word (not an affix or a phrase)"""
    return c["cls"] not in ("suffix", "prefix", "clitic", "phrase") and not re.search(r"[\s\-=]", c["hw"])


# ---- In numbers ---------------------------------------------------------------------------------------------
def stats(data, tok):
    E = data["entries"]
    words = [t for c in E if is_word(c) and (t := tok(c["hw"].lower()))]
    names = {}
    for c in E:
        for d in c.get("sd", []):
            m = re.match(r"^([\d.]+)\s+(.*)$", d)
            if m:
                names[m.group(1)] = m.group(2)
    for code in list(names):
        names.setdefault(code.split(".")[0], DDP_TOP.get(code.split(".")[0], code))
    num = lambda code: [int(x) for x in code.split(".")]
    topics = []
    for code in sorted(names, key=num):
        n = sum(1 for c in E if any(d.startswith(code + " ") or d.startswith(code + ".") for d in c.get("sd", [])))
        depth = sum(1 for k in range(1, len(code.split("."))) if ".".join(code.split(".")[:k]) in names)
        topics.append([code, names[code], n, depth])
    order = [u for row in data["keyboard"] for u in row]
    every = Counter(u for t in words for u in t)
    first = Counter(t[0] for t in words)
    return {
        "entries": len(E),
        "audio": sum(1 for c in E if c.get("audio")),
        "examples": sum(1 for c in E if any(s.get("ex") for s in c.get("senses", []))),
        "sentences": len(data["sentences"]),
        "classes": [[CLASS_NAMES.get(k, k), n, k] for k, n in Counter(c["cls"] for c in E).most_common()],
        "topics": topics,
        "noTopic": sum(1 for c in E if not c.get("sd")),
        "words": len(words),
        "lengths": sorted(Counter(len(t) for t in words).items()),
        "sounds": [[u, every[u], first[u]] for u in order if every[u]],
        "soundTotal": sum(every.values()),
    }


# ---- minimal pairs ------------------------------------------------------------------------------------------
def minimal_pairs(data, tok):
    E = data["entries"]
    forms = {}                                            # tokens -> [entry index] (homographs share a node)
    for i, c in enumerate(E):
        if is_word(c) and (t := tok(c["hw"].lower())):
            forms.setdefault(tuple(t), []).append(i)
    hw = {c["hw"]: i for i, c in enumerate(E)}
    same_word = set()                                     # variants of each other are not pairs
    for i, c in enumerate(E):
        for x in c.get("see", []):
            if x[1] in hw:
                same_word.add(frozenset((i, hw[x[1]])))
        for x in c.get("va", []):
            if x[0] in hw:
                same_word.add(frozenset((i, hw[x[0]])))
    slots = defaultdict(list)
    for t in forms:
        for k in range(len(t)):
            slots[(len(t), k, t[:k] + t[k + 1:])].append(t)
    edges = []
    for (_, k, _), ts in slots.items():
        for a, b in itertools.combinations(sorted(ts), 2):
            if any(frozenset((x, y)) in same_word for x in forms[a] for y in forms[b]):
                continue
            edges.append((a, b, k))
    nodes = sorted({t for a, b, _ in edges for t in (a, b)}, key=lambda t: E[forms[t][0]]["sk"])
    num = {t: n for n, t in enumerate(nodes)}
    xy, w, h = layout(len(nodes), [(num[a], num[b]) for a, b, _ in edges])
    pos = Counter("first" if k == 0 else "last" if k == len(a) - 1 else "middle" for a, b, k in edges)
    return {
        "words": [[".".join(t), forms[t]] for t in nodes],
        "edges": sorted([num[a], num[b], k] for a, b, k in edges),
        "xy": xy, "w": w, "h": h,
        "where": [pos["first"], pos["middle"], pos["last"]],
    }


def layout(n, edges):
    """a layout for each connected group of words (Kamada-Kawai: words one pair apart sit close, long chains spread
    out), then the biggest group on the left and the other groups in rows beside it and below it"""
    G = nx.Graph()
    G.add_nodes_from(range(n))
    G.add_edges_from(edges)
    shapes = []
    for g in sorted(nx.connected_components(G), key=lambda g: (-len(g), min(g))):
        size = 70 * len(g) ** 0.5 + 30                    # room per group grows with the number of words
        p = nx.kamada_kawai_layout(G.subgraph(g)) if len(g) > 2 else {v: (i * 2 - 1, 0) for i, v in enumerate(sorted(g))}
        xs, ys = [q[0] for q in p.values()], [q[1] for q in p.values()]
        sx, sy = (max(xs) - min(xs)) or 1, (max(ys) - min(ys)) or 1
        gw, gh = (size, size * sy / sx) if sx >= sy else (size * sx / sy, size)
        shapes.append((p, min(xs), min(ys), sx, sy, max(gw, 60), max(gh, 20)))
    xy, GAP = [None] * n, 40
    big_w, big_h = shapes[0][5], shapes[0][6]
    W, x0 = round(big_w * 1.9), big_w + GAP
    x, y, row_h = 0, 0, 0
    for k, (p, mx, my, sx, sy, gw, gh) in enumerate(shapes):
        if k == 1:
            x = x0
        elif k > 1 and x + gw > W:                          # next row: beside the big group, then under it
            y, row_h = y + row_h + GAP, 0
            x = x0 if y < big_h else 0
        for v, (px, py) in p.items():
            xy[v] = [round(x + (px - mx) / sx * gw), round(y + (py - my) / sy * gh)]
        if k == 0:
            continue
        x, row_h = x + gw + GAP, max(row_h, gh)
    return xy, W, round(max(big_h, y + row_h))


# ---- links between words ------------------------------------------------------------------------------------
def glosses(c):
    out = []
    for s in c.get("senses", []):
        for g in s.get("gl", []):
            for part in re.split(r"\s*[;,]\s*", g):
                p = suggest.clean(part)
                if p and "?" not in p:
                    out.append(p)
    return list(dict.fromkeys(out))


def links(data):
    E = data["entries"]
    found = [dict() for _ in E]                           # found[i][j] = (type, label)
    RANK = "xsoPWbn"

    def add(i, j, t, label=""):
        if i != j and (j not in found[i] or RANK.index(t) < RANK.index(found[i][j][0])):
            found[i][j] = (t, label)

    by_id = {c["id"]: i for i, c in enumerate(E)}
    by_hw = defaultdict(list)
    for i, c in enumerate(E):
        by_hw[c["hw"]].append(i)
    for i, c in enumerate(E):                             # the dictionary's own links, both ways
        for label, hw, _, ref in c.get("xref", []):
            for j in ([by_id[ref]] if ref in by_id else by_hw.get(hw, [])):
                add(i, j, "x", label)
                add(j, i, "x", label)
        for label, hw, ref, _ in c.get("see", []):
            for j in ([by_id[ref]] if ref in by_id else by_hw.get(hw, [])):
                add(i, j, "x", label)
                add(j, i, "x", "Has variant" if "ariant" in label else label)

    gl = [glosses(c) for c in E]
    by_gloss = defaultdict(set)
    for i, gs in enumerate(gl):
        for g in gs:
            by_gloss[g].add(i)
    for i, gs in enumerate(gl):                           # the same English gloss
        for g in gs:
            for j in by_gloss[g]:
                add(i, j, "s")

    if not (WORDNET / "index.noun").exists():
        print(f"No WordNet in {WORDNET}: only the dictionary's links and shared glosses")
        return found
    index, wn = suggest.read_wordnet(WORDNET)
    syn, main = [set() for _ in E], [set() for _ in E]   # all senses used / each gloss's commonest sense
    for i, c in enumerate(E):
        pos = WN_POS.get(c["cls"])
        if not pos:
            continue
        for g in gl[i]:
            senses = [(p, o, t) for p, o, t in index.get(g.replace(" ", "_"), []) if p == pos]
            use = [(p, o) for p, o, t in senses if t][:1 if pos == "verb" else SENSES] or [(p, o) for p, o, _ in senses[:1]]
            syn[i].update(s for s in use if not wn[s][2])
            main[i].update(s for s in use[:1] if not wn[s][2])
    owners, main_owners = defaultdict(set), defaultdict(set)
    for i, ss in enumerate(syn):
        for s in ss:
            owners[s].add(i)
        for s in main[i]:
            main_owners[s].add(i)
    ptrs = lambda s, syms: [(p, o) for sym, p, o in wn[s][1] if sym in syms]
    for i, ss in enumerate(syn):
        for s in ss:
            for j in owners[s]:
                add(i, j, "s")                            # one WordNet sense
            level = set(ptrs(s, ("@", "@i"))) if s in main[i] else set()   # broader, step by step up,
            for _ in range(UP):                                           # from and to commonest senses only
                hit = {j for b in level for j in main_owners[b]}
                if hit:
                    for j in hit:
                        add(i, j, "b")
                        add(j, i, "n")
                    break
                level = {u for b in level for u in ptrs(b, ("@", "@i"))}
            for p in ptrs(s, ("%p", "%m", "%s")):         # its parts / members / substances
                for j in owners[p]:
                    add(i, j, "P")
                    add(j, i, "W")
            cluster = {s, *ptrs(s, ("&",))}               # adjectives: a satellite's head carries the antonym
            for a in {t for x in cluster for t in ptrs(x, ("!",))}:
                for j in owners[a] | {k for x in ptrs(a, ("&",)) for k in owners[x]}:
                    add(i, j, "o")
                    add(j, i, "o")
    return found


def stamp(page):
    text = page.read_text(encoding="utf-8")

    def fp(m):
        f = (page.parent / m.group(2)).resolve()
        return f'{m.group(1)}{m.group(2)}?v={hashlib.md5(f.read_bytes()).hexdigest()[:8]}"' if f.exists() else m.group(0)
    page.write_text(re.sub(r'((?:src|href)=")([\w./-]+\.(?:js|css))(?:\?v=\w+)?"', fp, text), encoding="utf-8")


def main():
    data = load()
    tok = tokenizer(data)
    found = links(data)
    out = {
        "built": date.today().isoformat(),
        "stats": stats(data, tok),
        "pairs": minimal_pairs(data, tok),
        "links": [[[j, t, label] if label else [j, t] for j, (t, label) in sorted(f.items())] for f in found],
    }
    OUT.mkdir(exist_ok=True)
    (OUT / "explore-data.js").write_text("window.EXPLORE = " + json.dumps(out, ensure_ascii=False, separators=(",", ":"))
                                         + ";\n", encoding="utf-8")
    if (OUT / "index.html").exists():
        stamp(OUT / "index.html")
    kinds = Counter(t for f in found for t, _ in f.values())
    p = out["pairs"]
    print(f"{len(p['edges'])} minimal pairs among {len(p['words'])} words")
    print(f"links: {sum(1 for f in found if f)} entries have some; by kind {dict(sorted(kinds.items()))}")
    print(f"wrote {OUT / 'explore-data.js'} ({(OUT / 'explore-data.js').stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
