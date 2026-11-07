#!/usr/bin/env python3
"""Turn the Toolbox/MDF lexicon (Text sample/lexicon.db) into the data file for
the web dictionary in docs/.

    python3 build.py            # writes docs/data/dictionary.js

Records marked \\pr N (not for print) are left out, and the working-note fields
in DROP never reach the website.  Everything else is grouped into entries,
senses and subentries (\\se) and written as one JavaScript data file, so the
site works both on GitHub Pages and when index.html is opened from disk.
"""
import json
import re
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEXICON = HERE.parent / "Text sample" / "lexicon.db"
OUT = HERE / "docs" / "data" / "dictionary.js"

# ---- what each MDF marker becomes on the site --------------------------------
INFL = {"3s": "3rd person singular", "3p": "3rd person plural",
        "1s": "1st person singular", "1p": "1st person plural",
        "2s": "2nd person singular", "2p": "2nd person plural"}
XREF = {"cf": "See also", "sy": "Same meaning", "an": "Opposite",
        "mn": "Main entry", "rd": "Reduplicated form"}
NOTES = {"ng": "Grammar", "np": "Pronunciation", "ph": "Phonetic", "na": "Culture",
         "ns": "Note", "nl": "Note", "ne": "Note", "mr": "Morphology", "u": "Morphemes"}
ETYM = {"bw": "Borrowed from", "et": "Etymology", "eg": "Etymology gloss",
        "es": "Etymology source", "ec": "Etymology note"}
SOURCES = {"so": "Source", "rf": "Reference", "cr": "Also recorded in",
           "us": "Speaker", "ln": "Laves notebook"}
# Working notes, queries to self, print/learner flags, media without files.
DROP = {"nq", "nto", "nta", "nu", "nx", "nt", "tg", "gt", "roc", "pr", "fr", "th",
        "img", "imgc", "wav", "xn", "un", "gn", "dn", "rn", "sd", "_sh"}

LETTERS = ["a", "b", "d", "g", "i", "j", "k", "l", "m", "n", "ng", "ny",
           "o", "p", "r", "t", "u", "w", "y"]


def read_lines(path):
    """Lines are mostly cp1252 with some UTF-8 (IPA, ø); '¿' is the old null-root symbol."""
    out = []
    for raw in path.read_bytes().split(b"\n"):
        raw = raw.rstrip(b"\r")
        try:
            line = raw.decode("utf-8")
        except UnicodeDecodeError:
            line = raw.decode("cp1252", errors="replace")
        out.append(line.replace("ˆ", "").replace("¿", "ø"))
    return out


def records(lines):
    """Yield each \\lx record as a list of [marker, value]; wrapped lines are joined."""
    rec = None
    for line in lines:
        m = re.match(r"\\(\S+) ?(.*)", line)
        if m:
            tag, val = m.group(1), m.group(2).strip()
            if tag == "lx":
                if rec:
                    yield rec
                rec = []
            if rec is not None:
                rec.append([tag, val])
        elif line.strip() and rec:
            rec[-1][1] = (rec[-1][1] + " " + line.strip()).strip()
    if rec:
        yield rec


def tidy_gloss(s):
    """'wander_around.feeling.lost' -> 'wander around feeling lost' (markup like |tsc{1a.IO} kept)."""
    parts = re.split(r"(\|[a-z]+\{[^}]*\})", s)
    parts = [p if p.startswith("|") else
             re.sub(r"(?<=[A-Za-z'])\.(?=[A-Za-z])", " ", p.replace("_", " "))
             for p in parts]
    return re.sub(r"\s+", " ", "".join(parts)).strip(" ;,")


def split_ge(val):
    """'bury:_he.buried.it' -> ('bury', 'he buried it'): the part after the colon glosses the 3s form."""
    g, colon, rest = val.partition(":")
    if colon and re.match(r"[\s_.]*(he|she|it|they|we|i|you)(?![a-z])", rest, re.I):
        return tidy_gloss(g), tidy_gloss(rest)
    return tidy_gloss(val), ""


def blank_sense(ps="", n=""):
    return {"n": n, "ps": ps, "gl": [], "de": [], "ex": [], "sc": [], "nt": [], "lt": [], "ug": []}


def new_container(hw):
    return {"hw": hw, "hm": "", "lc": "", "ps": "", "_ps": "", "senses": [], "va": [],
            "infl": [], "g3s": "", "para": [], "lf": [], "xref": [], "place": "", "fl": [],
            "notes": [], "ety": [], "src": [], "status": "", "dt": "", "sf": "", "subs": []}


def has_content(s):
    return s["gl"] or s["de"] or s["ex"]


def build_entry(fields, unused):
    entry = None
    c = None
    for tag, val in fields:
        if tag in DROP:
            continue
        if tag == "lx":
            entry = c = new_container(val)
            continue
        if tag == "se":
            c = new_container(val)
            entry["subs"].append(c)
            continue
        if tag == "ps":
            if not val:
                continue
            c["ps"] = c["ps"] or val
            if c["senses"] and has_content(c["senses"][-1]):
                c["senses"].append(blank_sense(val))
            elif c["senses"]:
                c["senses"][-1]["ps"] = val
            c["_ps"] = val
            continue
        if tag == "sn":
            num = val if re.fullmatch(r"\d+", val) else ""
            if c["senses"] and not has_content(c["senses"][-1]) and not c["senses"][-1]["n"]:
                c["senses"][-1]["n"] = num
            else:
                c["senses"].append(blank_sense(c["_ps"], num))
            continue
        if not val:
            continue
        if not c["senses"]:
            c["senses"].append(blank_sense(c["_ps"]))
        s = c["senses"][-1]
        where = f" (sense {s['n']})" if s["n"] else ""

        if tag == "ge":
            g, g3 = split_ge(val)
            if g and g not in s["gl"]:
                s["gl"].append(g)
            if g3 and not c["g3s"]:
                c["g3s"] = g3
        elif tag == "de":
            s["de"].append(val)
        elif tag == "xv":
            s["ex"].append({"v": val, "e": ""})
        elif tag == "xe":
            if s["ex"] and not s["ex"][-1]["e"]:
                s["ex"][-1]["e"] = val
        elif tag == "sc":
            s["sc"].append(val)
        elif tag in ("ue", "ee", "oe"):
            s["nt"].append(val)
        elif tag == "lt":
            s["lt"].append(val)
        elif tag == "ug":
            s["ug"].append(val)
        elif tag == "hm":
            c["hm"] = val
        elif tag == "lc":
            c["lc"] = val
        elif tag == "va":
            c["va"].append([val, ""])
        elif tag == "ve":
            if c["va"] and not c["va"][-1][1]:
                c["va"][-1][1] = val
        elif tag in INFL:
            c["infl"].append([INFL[tag], val])
        elif tag == "pdl":
            c["para"].append([val, "", ""])
        elif tag == "pdv":
            if c["para"] and not c["para"][-1][1]:
                c["para"][-1][1] = val
            else:
                c["para"].append(["", val, ""])
        elif tag == "pde":
            if c["para"]:
                c["para"][-1][2] = val
        elif tag == "lf":
            c["lf"].append([val, "", ""])
        elif tag == "lv":
            if c["lf"] and not c["lf"][-1][1]:
                c["lf"][-1][1] = val
            else:
                c["lf"].append(["", val, ""])
        elif tag == "le":
            if c["lf"]:
                c["lf"][-1][2] = val
            else:
                c["lf"].append(["", "", val])
        elif tag in XREF:
            c["xref"].append([XREF[tag], val, ""])
        elif tag == "ce":
            if c["xref"] and c["xref"][-1][0] == XREF["cf"] and not c["xref"][-1][2]:
                c["xref"][-1][2] = val
        elif tag == "re":
            if val.lower().startswith("places"):
                c["place"] = c["place"] or val.split(":", 1)[-1].strip()
            elif val != "*":
                c["fl"].append(val)
        elif tag in NOTES:
            c["notes"].append([NOTES[tag] + where, val])
        elif tag in ETYM:
            c["ety"].append([ETYM[tag], val.strip("()")])
        elif tag in SOURCES:
            c["src"].append([SOURCES[tag] + where, val])
        elif tag == "st":
            if val.upper().startswith("NK"):
                c["status"] = "NK"
        elif tag == "dt":
            c["dt"] = val
        elif tag == "sf":
            c["sf"] = c["sf"] or val
        else:
            unused[tag] += 1
    return entry


# ---- classification, sorting, ids -------------------------------------------
def word_class(c):
    hw, lc, ps = c["hw"], c["lc"], c["ps"].lower()
    if hw.startswith("=") or lc.startswith("="):
        return "clitic"
    if "suff" in ps or (hw.startswith("-") and not hw.endswith("-")):
        return "suffix"
    if ps in ("v.pre", "n.pre") or (hw.endswith("-") and not hw.startswith("-") and " " not in hw):
        return "prefix"
    if (c["place"] or c["sf"] in ("Vp", "Vpl")) and (not ps or ps.startswith("n")):
        return "place"
    if "phr" in ps:
        return "phrase"
    if ps.startswith(("int", "ij", "excl")):
        return "interjection"
    if ps.startswith("adj"):
        return "adjective"
    if ps.startswith(("adv", "loc")):
        return "adverb"
    if ps in ("pro", "pp", "pposs", "pqst", "pid", "pi", "dem", "interrog", "intq") or ps.startswith("pqst"):
        return "pronoun"
    if ps.startswith("v"):
        return "verb"
    if ps.startswith(("n", "cn", "pl.n")):
        return "noun"
    if not ps and re.search(r"\s-\S+-", lc or hw):
        return "verb"
    return "other"


def bare(hw):
    return re.sub(r"[-=+*()]", "", hw.lower()).strip()


def letter_of(hw):
    s = re.sub(r"^[-=+*( ]+", "", hw.lower())
    if s[:2] in ("ng", "ny"):
        return s[:2]
    return s[:1] or "?"


def sort_key(hw):
    s = re.sub(r"[-=+*()]", "", hw.lower()).strip()
    s = s.replace("ng", "n{").replace("ny", "n|")   # ng and ny sort as letters after n
    return re.sub(r"\s+", " ", s)


def slugify(hw, hm):
    s = re.sub(r"\s+", "_", hw.strip().lower())
    s = re.sub(r"[^\w\-=+ø()~.]", "", s)
    return s + (f".{hm}" if hm else "")


def clean(c):
    """Drop empty fields so the data file stays small."""
    out = {}
    for k, v in c.items():
        if k.startswith("_") or v in ("", [], None):
            continue
        if k == "senses":
            v = [{sk: sv for sk, sv in s.items() if sv not in ("", [])} for s in v]
            v = [s for s in v if set(s) - {"n", "ps"}]
            if not v:
                continue
        out[k] = v
    return out


def main():
    lines = read_lines(LEXICON)
    unused = Counter()
    entries, skipped = [], 0
    for rec in records(lines):
        prt = next((v for t, v in rec if t == "pr"), "")
        if prt.upper().startswith("N"):
            skipped += 1
            continue
        e = build_entry(rec, unused)
        if e:
            entries.append(e)

    seen = Counter()
    for e in entries:
        for c in [e] + e["subs"]:
            c["cls"] = word_class(c)
            c["sk"] = sort_key(c["lc"] or c["hw"]) if c is not e else sort_key(c["hw"])
            c["L"] = letter_of(c["hw"])
        slug = slugify(e["hw"], e["hm"])
        seen[slug] += 1
        e["id"] = slug if seen[slug] == 1 else f"{slug}~{seen[slug]}"

    entries.sort(key=lambda e: (e["sk"], e["hm"]))
    data = {"entries": [dict(clean(e), subs=[clean(s) for s in e["subs"]]) for e in entries],
            "letters": LETTERS,
            "source": LEXICON.name}
    for d in data["entries"]:
        if not d["subs"]:
            del d["subs"]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    js = "window.BARDI_DICT = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    OUT.write_text(js, encoding="utf-8")

    nsub = sum(len(e.get("subs", [])) for e in data["entries"])
    cls = Counter(c["cls"] for e in data["entries"] for c in [e] + e.get("subs", []))
    print(f"{len(data['entries'])} entries + {nsub} subentries written to {OUT.relative_to(HERE)}"
          f" ({OUT.stat().st_size // 1024} KB); {skipped} records marked \\pr N left out")
    print("classes:", dict(cls.most_common()))
    if unused:
        print("markers not shown on the site:", dict(unused.most_common()))


if __name__ == "__main__":
    main()
