#!/usr/bin/env python3
"""Build the Kullilli web dictionary (docs/ in this repository) from the
source material, which is kept outside the repository.

    python3 build/build_lift.py                      # source in ../KullilliDictionary
    python3 build/build_lift.py /path/to/KullilliDictionary

Reads data/Kullilli.lift, data/audio/ and data/Kullilli sentences.docx from
the source folder; writes docs/data/dictionary.js and copies the sound files
the dictionary uses into docs/audio/.  Untyped FLEx notes are shown (as
"Note") while SHOW_UNTYPED_NOTES is True.

The interlinear sentences are linked to the entries for their stems and
affixes and shown as examples in those entries.  The glossing review files
(and the list of morphemes that can't be matched to an entry) go to review/
in the source folder.
"""
import json
import re
import shutil
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

sys.dont_write_bytecode = True        # no __pycache__ in the repository
import glosscheck                     # noqa: E402
import suggest                        # noqa: E402
from sentences import parse as parse_sentences   # noqa: E402

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SOURCE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else REPO.parent / "KullilliDictionary"
LIFT = SOURCE / "data" / "Kullilli.lift"
AUDIO_IN = SOURCE / "data" / "audio"
SENTENCES = SOURCE / "data" / "Kullilli sentences.docx"
REVIEW = SOURCE / "review"
OUT = REPO / "docs" / "data" / "dictionary.js"
AUDIO_OUT = REPO / "docs" / "audio"

LANGUAGE = "Kullilli"
VERN = "gll-Latn"                 # vernacular writing system
AUDIO_WS = "gll-Zxxx-x-audio"     # audio writing system (file names)
ENG = "en"
SHOW_UNTYPED_NOTES = True        # Claire, 2026-11-06: show them all
# Entries left out of the site: "aaa" is a "how to use the dictionary" note, now on the About page (Claire, 2026-11-07).
SKIP_ENTRIES = {"aaa"}
# English suggestions in the search (infant -> child) come from the WordNet 3.1 database files in this folder;
# without it, the last docs/data/suggest.js is kept.
WORDNET = REPO.parent / "Wordnet_dict"
# Feedback (problems, ideas, comments on words) goes to GitHub issues, using the forms in .github/ISSUE_TEMPLATE/.
# FEEDBACK_REPO = "owner/repository"; empty = the site works it out from its github.io address.
# FEEDBACK_EMAIL (optional) is offered to people without a GitHub account.
FEEDBACK_REPO = ""
FEEDBACK_EMAIL = "chirila.apps@gmail.com"   # Claire, 2026-11-07

# Two-letter letters: own tab in the wordlist, sorted after their first letter (d, dh, dy, ...).
DIGRAPHS = ["dh", "dy", "ng", "nh", "ny", "th", "ty"]
# Spelling key for "similar spelling" search, applied in order (JavaScript regex syntax).
# Exact spellings always rank first; these only widen the net.
SPELLING = [
    ["ŋ", "ng"], ["ɲ", "ny"], ["[ðᶁ]", "dh"], ["[ɹɾ]", "r"], ["ɣ", "g"], ["β", "b"],
    ["tj|dj|ch|ty|j", "dy"], ["th", "dh"],
    ["k", "g"], ["p", "b"], ["t", "d"],            # voicing
    ["rr", "r"], ["r(?=[dln])", ""],                # trill/tap, retroflex
    ["([dnl])h", "$1"],                             # dental vs alveolar
    ["aa", "a"], ["ii|ee|e", "i"], ["uu|oo|o", "u"],  # vowel length, o/u, e/i
    ["(.)\\1+", "$1"],                              # doubled letters
]

# The alphabet from the sketch grammar, as the on-screen keyboard of the Hidden word game.
# Two-letter units (dh, ng, rr ...) count as one letter there.
KEYBOARD = [["a", "i", "u", "w", "y", "b", "p", "m"],
            ["dh", "th", "nh", "lh", "d", "t", "n", "l"],
            ["dy", "ty", "ny", "ly", "rd", "rt", "rn", "rl"],
            ["r", "rr", "g", "k", "ng"]]

POS_CLASS = {"noun": "noun", "n": "noun", "verb": "verb", "v": "verb", "intransitive verb": "verb",
             "transitive verb": "verb", "adjective": "adjective", "adverb": "adverb",
             "pronoun": "pronoun", "pro": "pronoun", "demonstrative": "pronoun",
             "exclamation": "interjection", "phrase": "phrase"}
MORPH_CLASS = {"suffix": "suffix", "prefix": "prefix", "infix": "prefix",
               "clitic": "clitic", "enclitic": "clitic", "proclitic": "clitic"}
# Typed sense notes shown under the meaning; other typed notes go to "Notes, etymology and sources".
SENSE_NOTE_TYPES = {"semantics", "grammar", "sociolinguistics", "encyclopedic", "anthropology", "discourse"}
NOTE_LABELS = {"phonology": "Pronunciation", "bibliography": "Bibliography", None: "Note", "": "Note"}


# ---- small XML helpers --------------------------------------------------------
def text_of(el):
    if el is None:
        return ""
    t = el.find("text")
    return re.sub(r"\s+", " ", "".join((t if t is not None else el).itertext())).strip()


def form(parent, lang=VERN):
    if parent is None:
        return ""
    for f in parent.findall("form"):
        if f.get("lang") == lang:
            return text_of(f)
    return ""


def traits(el, name):
    return [t.get("value") for t in el.findall("trait") if t.get("name") == name and t.get("value")]


def add_once(lst, item):
    if item and item not in lst:
        lst.append(item)


# ---- entries -------------------------------------------------------------------
def new_container(hw):
    return {"hw": hw, "hm": "", "lc": "", "ps": "", "senses": [], "va": [], "see": [], "xref": [],
            "orig": [], "audio": "", "place": "", "fl": [], "sd": [], "notes": [], "ety": [],
            "src": [], "dt": ""}


def add_sense(c, s, sources):
    gi = s.find("grammatical-info")
    ps = (gi.get("value") or "").strip().lower() if gi is not None else ""
    sense = {"n": "", "ps": ps, "gl": [], "de": [], "ex": [], "sc": [], "nt": [], "lt": [], "ug": []}
    for g in s.findall("gloss"):
        if g.get("lang") == ENG:
            add_once(sense["gl"], text_of(g))
    add_once(sense["de"], form(s.find("definition"), ENG))
    for x in s.findall("example"):
        v = form(x)
        if v:
            sense["ex"].append({"v": v, "e": form(x.find("translation"), ENG), "ref": x.get("source") or ""})
    for n in s.findall("note"):
        typ, val = n.get("type"), form(n, ENG)
        if not val:
            continue
        if typ == "source":
            for part in val.split(", "):
                add_once(sources, part.strip())
        elif typ in SENSE_NOTE_TYPES:
            sense["nt"].append(val)
        elif typ or SHOW_UNTYPED_NOTES:
            c["notes"].append([NOTE_LABELS.get(typ, typ.capitalize() if typ else "Note"), val])
    for d in traits(s, "semantic-domain-ddp4"):
        add_once(c["sd"], d)
    for v in traits(s, "dialect-labels"):
        add_once(sources, v)
    for r in s.findall("reversal"):
        add_once(c["fl"], form(r, ENG))
    c["ps"] = c["ps"] or ps
    c["senses"].append(sense)
    for sub in s.findall("subsense"):
        add_sense(c, sub, sources)


def build_entry(e):
    lu = e.find("lexical-unit")
    cit = e.find("citation")
    c = new_container(form(lu))
    if form(cit) and form(cit) != c["hw"]:
        c["lc"] = form(cit)                       # FLEx shows the citation form as headword
    c["hm"] = e.get("order") or ""
    c["audio"] = form(lu, AUDIO_WS) or form(cit, AUDIO_WS)
    c["dt"] = (e.get("dateModified") or "")[:10]
    c["_morph"] = (traits(e, "morph-type") or [""])[0]
    sources = []
    for v in traits(e, "dialect-labels"):
        add_once(sources, v)
    for f in e.findall("field"):
        if f.get("type") == "Original Orthography" and form(f) not in (c["hw"], c["lc"]):
            add_once(c["orig"], form(f))
    for n in e.findall("note"):
        typ, val = n.get("type"), form(n, ENG)
        if val and (typ or SHOW_UNTYPED_NOTES):
            c["notes"].append([NOTE_LABELS.get(typ, typ.capitalize() if typ else "Note"), val])
    for et in e.findall("etymology"):
        if et.get("type") == "borrowed":
            c["ety"].append(["Borrowed from", et.get("source") or form(et, ENG) or ""])
    for v in e.findall("variant"):
        add_once(c["va"], [form(v), "", form(v, AUDIO_WS), ""])
    for s in e.findall("sense"):
        add_sense(c, s, sources)
    # merge sources that differ only in capitals
    seen = {}
    for s in sources:
        seen.setdefault(s.lower(), s)
    if seen:
        c["src"].append(["Sources", "; ".join(seen.values())])
    return c


def word_class(c):
    if c["_morph"] in MORPH_CLASS:
        return MORPH_CLASS[c["_morph"]]
    if any(d.startswith("9.7.2") for d in c["sd"]):
        return "place"
    return POS_CLASS.get(c["ps"], "phrase" if c["_morph"] == "phrase" else "other")


# ---- sorting, letters, ids -------------------------------------------------------
def letter_of(hw):
    s = re.sub(r"^[-=*( ]+", "", hw.lower())
    return s[:2] if s[:2] in DIGRAPHS else (s[:1] or "?")


def sort_key(hw):
    s = re.sub(r"[-=*()]", "", hw.lower()).strip()
    for k, d in enumerate(DIGRAPHS):              # dh, dy ... sort after every other d-
        s = s.replace(d, d[0] + chr(0x7B + k))
    return re.sub(r"\s+", " ", s)


def slugify(hw, hm):
    s = re.sub(r"\s+", "_", hw.strip().lower())
    s = re.sub(r"[^\w\-=+ø()~.]", "", s)
    return (s or "entry") + (f".{hm}" if hm else "")


def clean(c):
    out = {}
    for k, v in c.items():
        if k.startswith("_") or v in ("", [], None):
            continue
        if k == "senses":
            v = [{sk: sv for sk, sv in s.items() if sv not in ("", [])} for s in v]
            v = [s for s in v if set(s) - {"n", "ps"}]
            if not v:
                continue
            for s in v:
                for x in s.get("ex", []):
                    if not x.get("ref"):
                        x.pop("ref", None)
        out[k] = v
    return out


# ---- interlinear sentences ------------------------------------------------------
def text_key(title):
    """'193-256 Kullilli sentences' -> '193-256' (matches the LIFT example references)."""
    m = re.match(r"^(\d{3}-\d{3})\b", title)
    return m.group(1) if m else title


def attach_sentences(pairs, by_id):
    """Link each morpheme to its dictionary entry; give each entry the sentences that use it.
    Returns the sentence list for the data file and a count of unmatched morphemes."""
    sents = parse_sentences(SENTENCES)
    main_of = lambda c: by_id[c["see"][0][1]] if c["see"] and not c["senses"] else c
    shown = lambda c: c["lc"] or c["hw"]
    glosses = lambda c: [g.lower() for s in main_of(c)["senses"] for g in s["gl"]]
    words = lambda s: set(re.findall(r"[a-z0-9.]+", s.lower()))

    loose = lambda f: re.sub(r"(.)\1+", r"\1", re.sub(r"[:̣]", "", f.lower()))   # rr/r, long marks
    index, loose_index = defaultdict(list), defaultdict(list)
    rank = {}                   # how the form was found: 0 headword, 1 variant, 2 source spelling
    for _, c in pairs:
        forms = [(f, 0) for f in (c["hw"], c["lc"])] + [(v[0], 1) for v in c["va"] if not v[3]]
        forms += [(f, 2) for f in c["orig"]]
        for f, r in forms:
            for part in re.split(r"\s*,\s*|\s+" if r == 2 else r"\s*,\s*", f or ""):
                for ix, key in ((index, part.lower()), (loose_index, loose(part))):
                    if part and c not in ix[key]:
                        ix[key].append(c)
                    if part:
                        rank[(key, id(c))] = min(rank.get((key, id(c)), 3), r)

    def agrees(g, c):
        """2 = same gloss, 1 = shares a word (or abbreviation: refl ~ reflexive), 0 = different.
        Labels are compared in their standard form (IRR = irrealis, INCH. = inchoative)."""
        g = glosscheck.standard(g).lower()
        G = [glosscheck.standard(x).lower() for x in glosses(c)]
        if g in G:
            return 2
        a, b = words(g), words(" ".join(G))
        return 1 if a & b or any(x.startswith(y) or y.startswith(x) for x in a for y in b if min(len(x), len(y)) >= 3) else 0

    def prefer(cands, key):
        """Break a tie: an entry beats its own spelling variant; a headword beats a variant beats a source spelling."""
        ids = {c["id"] for c in cands}
        cands = [c for c in cands if not (c["see"] and c["see"][0][1] in ids)] or cands
        best = min(rank.get((key, id(c)), 3) for c in cands)
        return [c for c in cands if rank.get((key, id(c)), 3) == best]

    def find(m):
        """The sentence gloss decides between entries; FLEx homograph numbers (which have changed
        since the sentences were exported) only break ties.  Returns (entry or None, candidates seen)."""
        g = m["g"].lower().strip()
        checkable = bool(g) and g != "***" and not g.isdigit()
        seen = []
        if not checkable:          # no gloss to decide with: link only if every spelling match is one entry
            mains = {}
            for tok in (m["e"], m["f"]):
                if tok and tok != "***":
                    form = re.match(r"^(.*?)(\d*)$", tok).group(1)
                    for c in index.get(form.lower(), []) + loose_index.get(loose(form), []):
                        mains[main_of(c)["id"]] = main_of(c)
            return (next(iter(mains.values())), []) if len(mains) == 1 else (None, list(mains.values()))
        for tok in (m["e"], m["f"]):                   # FLEx entry line first, then the morpheme as written
            if not tok or tok == "***":
                continue
            form, hm = re.match(r"^(.*?)(\d*)$", tok).groups()
            for key, ix in ((form.lower(), index), (loose(form), loose_index)):
                found = ix.get(key, [])
                seen += [main_of(c) for c in found if main_of(c) not in seen]
                if checkable and found:
                    scored = [(agrees(g, c), c) for c in found]
                    best = max(s for s, _ in scored)
                    found = [c for s, c in scored if s == best and best > 0]
                if len({main_of(c)["id"] for c in found}) > 1:
                    found = prefer(found, key)
                if len({main_of(c)["id"] for c in found}) > 1 and hm:
                    found = [c for c in found if c["hm"] == hm] or found
                mains = list({main_of(c)["id"]: main_of(c) for c in found}.values())
                if len(mains) == 1:
                    return mains[0], seen
        return None, seen

    out, uses, unlinked, by_ref, by_text = [], defaultdict(list), Counter(), {}, {}
    first_ref, has = {}, {}
    norm = lambda s: re.sub(r"[^a-zŋ]", "", s.lower())
    for si, s in enumerate(sents):
        tk = text_key(s["text"])
        by_ref[(tk, s["ref"].split("/")[-1])] = si
        by_text.setdefault(norm(s["line"]), si)
        ms = []
        for m in s["morphs"]:
            c, seen = find(m) if m["f"] != "***" else (None, [])
            if not c and m["f"] != "***":
                key = (m["f"], m["g"], m["e"])
                unlinked[key] += 1
                first_ref.setdefault(key, f"{tk} {s['ref']}")
                has[key] = "; ".join(f"{shown(x)} '{', '.join(glosses(x))}'" for x in seen)
            ms.append([m["f"], m["g"], c["id"] if c else ""])
        out.append({"t": tk, "n": s["ref"], "v": s["line"], "w": s["words"], "g": s["groups"], "m": ms,
                    "a": s["aligned"], "ft": s["ft"], "ln": s["notes"] + s["comments"]})

    # glossing review (step 2): report on the data as it is, then apply Claire's decisions
    glosscheck.review(out, by_id, REVIEW)
    n_lab, n_morph = glosscheck.apply(out, by_id, REVIEW)
    print(f"glossing decisions applied: {n_lab} labels, {n_morph} morphemes ({REVIEW}/gloss_*.tsv)")
    for si, s in enumerate(out):
        for _, _, i in s["m"]:
            if i and si not in uses[i]:
                uses[i].append(si)

    # LIFT examples that are one of these sentences show the interlinear version instead
    matched = 0
    for _, c in pairs:
        in_senses = set()
        for sense in c["senses"]:
            for x in sense["ex"]:
                r = re.match(r"^(\S+)\s+(\d+)\.\d+$", x.get("ref", "").strip())
                si = by_ref.get((r.group(1), r.group(2))) if r else None
                if si is None:
                    si = by_text.get(norm(x["v"]))
                if si is not None:
                    x["s"] = si
                    in_senses.add(si)
                    matched += 1
        rest = [si for si in uses.get(c["id"], []) if si not in in_senses]
        c["xs"] = sorted(rest, key=lambda si: (len(out[si]["w"]), si))

    REVIEW.mkdir(exist_ok=True)
    with open(REVIEW / "unlinked_morphemes.tsv", "w", encoding="utf-8") as f:
        f.write("morpheme\tgloss in sentences\tFLEx entry line\tcount\tfirst sentence\tdictionary has\n")
        for key, n in unlinked.most_common():
            f.write("\t".join([*key, str(n), first_ref[key], has.get(key, "")]) + "\n")
    n_m = sum(len(s["m"]) for s in out)
    n_linked = sum(1 for s in out for m in s["m"] if m[2])
    print(f"{len(out)} sentences: {n_linked}/{n_m} morphemes linked to entries; "
          f"{sum(1 for _, c in pairs if c['xs'] or any(x.get('s') is not None for s in c['senses'] for x in s['ex']))} "
          f"entries get sentence examples; {matched} LIFT examples matched to their sentence; "
          f"{len(unlinked)} unmatched forms in {REVIEW / 'unlinked_morphemes.tsv'}")
    return out


def stamp_assets():
    """Write the links to the Learn-tab games (every docs/games/*.js and *.css, core first) into
    index.html, and add a content fingerprint to each script/stylesheet link (app.js?v=1a2b3c4d)
    so browsers fetch the new file after an update instead of a cached copy.
    To remove a game, delete its files from docs/games/ and rebuild."""
    import hashlib
    docs = OUT.parent.parent
    page = docs / "index.html"
    html = page.read_text(encoding="utf-8")
    fp = lambda rel: hashlib.md5((docs / rel).read_bytes()).hexdigest()[:8]

    def game_files(ext, first):
        names = sorted(p.name for p in (docs / "games").glob(f"*.{ext}"))
        return [first] + [n for n in names if n != first] if first in names else names

    styles = "".join(f'<link rel="stylesheet" href="games/{n}?v={fp("games/" + n)}">\n' for n in game_files("css", "games.css"))
    scripts = "".join(f'<script src="games/{n}?v={fp("games/" + n)}"></script>\n' for n in game_files("js", "core.js"))
    html = re.sub(r"(<!-- game styles[^>]*-->\n).*?(<!-- /game styles -->)", lambda m: m.group(1) + styles + m.group(2), html, flags=re.S)
    html = re.sub(r"(<!-- game scripts[^>]*-->\n).*?(<!-- /game scripts -->)", lambda m: m.group(1) + scripts + m.group(2), html, flags=re.S)
    for asset in ("style.css", "search.js", "render.js", "app.js", "data/dictionary.js"):
        html = re.sub(rf'((?:src|href)="{re.escape(asset)})(\?v=\w+)?"', rf'\1?v={fp(asset)}"', html)
    page.write_text(html, encoding="utf-8")
    write_service_worker(docs, html)


def write_service_worker(docs, html):
    """Offline use: list everything index.html loads (with its ?v= fingerprint) in docs/sw.js, so the site is
    saved for offline use and a new version replaces the old one.  Recordings are saved separately as they play.
    Also the site's "last updated" date (About page): today if anything on the site changed since the last
    build, else the date already there, so rebuilding without changes leaves every file as it was."""
    import hashlib, datetime
    meta = re.compile(r'<meta name="site-updated" content="[^"]*">\n')
    html = meta.sub("", html)
    refs = re.findall(r'(?:src|href)="(?!#|https?:|mailto:)([^"]+)"', html)
    extra = ["icons/ngulkana-192.png", "icons/ngulkana-512.png"]
    if (docs / "data" / "suggest.js").exists():       # loaded later by the search, so not in index.html
        extra.append("data/suggest.js?v=" + hashlib.md5((docs / "data" / "suggest.js").read_bytes()).hexdigest()[:8])
    assets = ["./"] + list(dict.fromkeys(refs + extra))
    version = hashlib.md5(("\n".join(assets) + html).encode("utf-8")).hexdigest()[:10]
    sw = docs / "sw.js"
    old = sw.read_text(encoding="utf-8")
    was = re.search(r"const VERSION = '(\w+)';\nconst UPDATED = '([\d-]+)';", old)
    updated = was.group(2) if was and was.group(1) == version else datetime.date.today().isoformat()
    block = f"const VERSION = '{version}';\nconst UPDATED = '{updated}';\nconst ASSETS = {json.dumps(assets, indent=1)};\n"
    sw.write_text(re.sub(r"(// <assets>\n).*?(// </assets>)", lambda m: m.group(1) + block + m.group(2), old, flags=re.S), encoding="utf-8")
    html = html.replace("<meta charset=\"utf-8\">\n", f'<meta charset="utf-8">\n<meta name="site-updated" content="{updated}">\n', 1)
    (docs / "index.html").write_text(html, encoding="utf-8")


def main():
    for p in (LIFT, AUDIO_IN, SENTENCES):
        if not p.exists():
            sys.exit(f"Can't find {p}\nGive the folder that holds the Kullilli source material, e.g.\n"
                     f"    python3 build/build_lift.py /path/to/KullilliDictionary")
    root = ET.parse(LIFT).getroot()
    lift_entries = [e for e in root.findall("entry") if not e.get("dateDeleted")]
    pairs = [(e, build_entry(e)) for e in lift_entries]

    # ids, classes, sort keys
    owner, seen = {}, Counter()
    for e, c in pairs:
        shown = c["lc"] or c["hw"]
        slug = slugify(shown, c["hm"])
        seen[slug] += 1
        c["id"] = slug if seen[slug] == 1 else f"{slug}~{seen[slug]}"
        c["cls"], c["sk"], c["L"] = word_class(c), sort_key(shown), letter_of(shown)
        owner[e.get("id")] = c
        for s in e.iter("sense"):
            owner[s.get("id")] = c

    first_gloss = lambda c: next((g for s in c["senses"] for g in s["gl"]), "")
    shown = lambda c: c["lc"] or c["hw"]

    # relations: variants, complex forms, compare, minimal pairs
    for e, c in pairs:
        for r in e.findall("relation"):
            t = owner.get(r.get("ref") or "")
            if t is None or t is c:
                continue
            tr = {x.get("name"): x.get("value") for x in r.findall("trait")}
            typ = r.get("type")
            if typ == "_component-lexeme" and "variant-type" in tr:
                kind = "spelling variant" if "Spelling" in tr["variant-type"] else "variant"
                add_once(c["see"], [f"{kind.capitalize()} of", t["id"], shown(t), first_gloss(t)])
                add_once(t["va"], [shown(c), kind if kind != "variant" else "", c["audio"], c["id"]])
            elif typ == "_component-lexeme":
                add_once(c["xref"], ["Made from", shown(t), first_gloss(t), t["id"]])
                add_once(t["xref"], ["Used in", shown(c), first_gloss(c), c["id"]])
            else:
                label = {"Compare": "See also", "minimal pair": "Minimal pair"}.get(typ, typ)
                add_once(c["xref"], [label, shown(t), first_gloss(t), t["id"]])
    by_id = {c["id"]: c for _, c in pairs}
    for _, c in pairs:
        if not c["senses"] and c["see"]:            # minor (variant) entry: same word class as its main entry
            c["cls"] = by_id[c["see"][0][1]]["cls"]

    sentences = attach_sentences(pairs, by_id)

    # audio: copy the files that exist, drop references to missing ones
    AUDIO_OUT.mkdir(parents=True, exist_ok=True)
    missing = []

    def check(name):
        if not name:
            return ""
        src = AUDIO_IN / name
        if not src.exists():
            missing.append(name)
            return ""
        dst = AUDIO_OUT / name
        if not dst.exists() or dst.stat().st_size != src.stat().st_size:
            shutil.copy2(src, dst)
        return name

    for _, c in pairs:
        c["audio"] = check(c["audio"])
        for v in c["va"]:
            v[2] = check(v[2])

    entries = sorted((c for _, c in pairs if c["hw"] not in SKIP_ENTRIES), key=lambda c: (c["sk"], c["hm"]))
    present = {c["L"] for c in entries}
    data = {"entries": [clean(c) for c in entries],
            "sentences": sentences,
            "abbr": glosscheck.abbreviations(sentences, by_id, REVIEW),
            "letters": sorted(present, key=sort_key),
            "source": LIFT.name, "language": LANGUAGE, "title": f"{LANGUAGE} Dictionary",
            "spelling": SPELLING, "keyboard": KEYBOARD,
            "langCode": VERN.split("-")[0], "feedback": {"repo": FEEDBACK_REPO, "email": FEEDBACK_EMAIL},
            "edited": max((c.get("dt") or "" for c in entries), default="")}     # newest FLEx edit (About page)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sug = OUT.parent / "suggest.js"
    n_sug = suggest.write(data["entries"], sug, WORDNET)
    if sug.exists():                                   # loaded by the search only when it's needed
        import hashlib
        data["suggest"] = f"data/suggest.js?v={hashlib.md5(sug.read_bytes()).hexdigest()[:8]}"
    OUT.write_text("window.DICT_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
                   encoding="utf-8")
    print(f"English suggestions: {n_sug} words" if n_sug is not None else f"English suggestions: no WordNet in {WORDNET}; kept the old file")

    stamp_assets()
    cls = Counter(c["cls"] for c in entries)
    n_audio = sum(1 for c in entries if c.get("audio"))
    print(f"{len(entries)} entries written to {OUT.relative_to(REPO)} ({OUT.stat().st_size // 1024} KB); "
          f"{n_audio} with audio, files copied to {AUDIO_OUT.relative_to(REPO)}/")
    print("classes:", dict(cls.most_common()))
    print("letters:", " ".join(data["letters"]))
    if missing:
        print(f"{len(missing)} audio file(s) referenced in the LIFT but not in audio/:", ", ".join(missing))


if __name__ == "__main__":
    main()
