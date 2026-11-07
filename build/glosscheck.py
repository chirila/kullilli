"""Glossing consistency for the Kullilli site (roadmap step 2).

On every build, review() writes three files to review/ from the sentences as they
are in the docx and the dictionary as it is in the LIFT:

  gloss_labels.tsv     every grammatical label (case, tense, pronoun labels ...) as
                       written, where it is used, and a proposed standard label
  gloss_by_morpheme.tsv  morphemes whose glosses conflict, that differ from the dictionary,
                       that aren't in the dictionary, or that are unglossed
  sentences_without_glosses.tsv

Claire's decisions go in the "decision" (and "link to") columns; they are kept
when the files are rewritten, and apply() puts them into the site.  Labels are shown
on the site as abbreviations (ACC, 1SG.ERG); "your abbreviation" overrides the proposal.
  decision = y      use the proposed label / gloss
  decision = text   use this text instead
  decision = n or empty   leave as it is
  link to = a headword (add a homograph number like garri2 if needed): link these morphemes to that entry
Nothing in the docx or the LIFT is changed.
"""
import csv
import re
from collections import Counter, defaultdict
from pathlib import Path

# Proposed standard labels: written form (lower case) -> (label, Leipzig-style abbreviation, note).
# Only spelling/format is standardised here; where the analysis itself is in doubt there is no proposal.
LABELS = {
    "accusative case": ("accusative", "ACC", ""), "accusative": ("accusative", "ACC", ""), "acc": ("accusative", "ACC", ""),
    "nominative": ("nominative", "NOM", ""), "nom": ("nominative", "NOM", ""),
    "ergative": ("ergative", "ERG", ""), "dative": ("dative", "DAT", ""), "locative": ("locative", "LOC", ""),
    "ablative": ("ablative", "ABL", ""), "allative": ("allative", "ALL", ""), "all": ("allative", "ALL", ""),
    "instrumental": ("instrumental", "INS", ""), "aversive case": ("aversive", "AVERS", ""),
    "proprietive": ("proprietive", "PROP", ""), "privative": ("privative", "PRIV", ""),
    "com (?)": ("comitative (?)", "COM", "uncertain in the source"),
    "perlative?": ("perlative (?)", "PERL", "uncertain in the source"),
    "present": ("present", "PRS", ""), "pre sent": ("present", "PRS", "typo"), "present tense": ("present", "PRS", ""),
    "past": ("past", "PST", ""), "future": ("future", "FUT", ""), "imperative": ("imperative", "IMP", ""),
    "purpose": ("purpose", "PURP", ""),
    "irr": ("irrealis", "IRR", ""), "irrealis": ("irrealis", "IRR", ""),
    "factual": ("factive", "FACT", 'the sketch grammar calls -lha "Factive"; the data says "factual"'),
    "possibility": ("possibility", "", 'sketch grammar: "Possibility: -langu"'),
    "refl": ("reflexive", "REFL", ""), "reflexive": ("reflexive", "REFL", ""),
    "reciprocal": ("reciprocal", "RECP", ""), "recip": ("reciprocal", "RECP", ""),
    "causative": ("causative", "CAUS", ""), "inchoative": ("inchoative", "INCH", ""), "inch.": ("inchoative", "INCH", ""),
    "emph": ("emphatic", "EMPH", ""), "emphatic": ("emphatic", "EMPH", ""), "dual": ("dual", "DU", ""),
    "participle?": ("participle (?)", "PTCP", "uncertain in the source"),
    "potential?": ("potential (?)", "POT", "uncertain in the source"),
    "apprehensive?": ("apprehensive (?)", "APPR", "uncertain in the source"),
}
# Labels that need Claire's analysis rather than a spelling fix.
NO_PROPOSAL = {
    "poss": 'possibility or possessive? (-langa; -langu is "possibility" in the grammar, "possessive" in 12 sentences)',
    "imp": 'usually means imperative, but the sketch grammar treats -dhika as "back" (direction) and flags this gloss',
    "circ ability": 'McDonald & Wurm\'s label; the dictionary definition says it doesn\'t fit the examples',
}
PRONOUN = re.compile(r"^[123]\s*(sg|dl|du|pl)\b", re.I)
UNGLOSSED = {"", "***", "?"}


def std_pronoun(g):
    """'1SG.ERG', '1sg erg', '1sg.Erg' -> '1sg.erg'."""
    return re.sub(r"[\s.]+", ".", g.strip().lower())


def standard(g):
    """The proposed standard form of a gloss (unchanged if there is no proposal)."""
    low = g.strip().lower()
    if low in LABELS:
        return LABELS[low][0]
    if PRONOUN.match(low):
        return std_pronoun(g)
    return g.strip()


def is_label(form, gloss, cls=""):
    return form.startswith(("-", "=")) or cls in ("suffix", "prefix", "clitic") or bool(PRONOUN.match(gloss.strip()))


def edit1(a, b):
    """True if a and b differ by at most two letters (insert/delete/substitute)."""
    if abs(len(a) - len(b)) > 2:
        return False
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1] <= 2


PERSON = {"1": "first person", "2": "second person", "3": "third person"}
PARTS = {"sg": "singular", "dl": "dual", "du": "dual", "pl": "plural", "masc": "masculine", "fem": "feminine",
         "nom": "nominative", "erg": "ergative", "acc": "accusative", "dat": "dative", "loc": "locative",
         "abl": "ablative", "all": "allative", "instr": "instrumental", "ins": "instrumental", "poss": "possessive",
         "gen": "genitive"}
TERMINOLOGY = {"factual"}      # proposals that change the term, not just its spelling: wait for Claire's decision


def expand_pronoun(label):
    """'1sg.erg' -> 'first person singular ergative'."""
    m = re.match(r"^([123])\s*(.*)$", std_pronoun(label))
    rest = [PARTS.get(p, p) for p in re.split(r"[.\s]+", m.group(2)) if p]
    return " ".join([PERSON[m.group(1)]] + rest)


def abbreviations(sents, entries, review_dir):
    """gloss as written on the site -> [abbreviation, full name], for every grammatical label that has one.
    Claire's own abbreviations ("your abbreviation" in gloss_labels.tsv) win over the proposals."""
    mine = {}
    for r in read_tsv(Path(review_dir) / "gloss_labels.tsv"):
        a = (r.get("your abbreviation") or "").strip()
        if a:
            full = decided(r, "proposed label") or r.get("proposed label") or r["label as written"]
            for k in (r["label as written"], decided(r, "proposed label")):
                if k:
                    mine[k.strip().lower()] = [a, full]
    glosses = {g for s in sents for _, g, _ in s["m"]}
    glosses |= {g for c in entries.values() if c["cls"] in ("suffix", "prefix", "clitic", "pronoun")
                for s in c["senses"] for g in s["gl"]}
    out = {}
    for g in sorted(glosses):                          # fixed order: rebuilding unchanged data gives the same file
        k = g.strip().lower()
        if not k or k in UNGLOSSED:
            continue
        if k in mine:
            out[g] = mine[k]
        elif k in LABELS and LABELS[k][1] and "(?)" not in LABELS[k][0]:
            out[g] = [LABELS[k][1], g.strip() if k in TERMINOLOGY else LABELS[k][0]]
        elif PRONOUN.match(k) and re.fullmatch(r"[123]\s*[a-z.\s]+", k):
            out[g] = [std_pronoun(g).replace("genitive", "gen").upper(), expand_pronoun(g)]
    return out


# ---- reading/writing review files, keeping Claire's columns -----------------------
KEEP = ("decision", "your abbreviation", "link to", "your note")


def read_tsv(path):
    if not path.exists():
        return []
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def write_tsv(path, header, rows, key):
    old = {key(r): r for r in read_tsv(path)}
    for r in rows:
        for k in KEEP:
            if k in header and old.get(key(r), {}).get(k):
                r[k] = old[key(r)][k]
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header, delimiter="\t", extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


# ---- the review ------------------------------------------------------------------------
def review(sents, entries, review_dir):
    """sents: site sentence records (m = [form, gloss, entry id]); entries: id -> entry."""
    review_dir = Path(review_dir)
    review_dir.mkdir(exist_ok=True)
    shown = lambda c: c["lc"] or c["hw"]
    glosses = lambda c: [g for s in c["senses"] for g in s["gl"]]
    ref = lambda s: f"{s['t']} {s['n']}"

    # 1. grammatical labels
    lab_sent, lab_dict, used_for = Counter(), Counter(), defaultdict(Counter)
    for s in sents:
        for f, g, _ in s["m"]:
            if g.strip() not in UNGLOSSED and is_label(f, g):
                lab_sent[g.strip()] += 1
                used_for[g.strip()][f] += 1
    for c in entries.values():
        for g in glosses(c):
            if is_label(c["hw"], g, c["cls"]):
                lab_dict[g.strip()] += 1
                used_for[g.strip()][shown(c)] += 1
    rows = []
    for lab in sorted(set(lab_sent) | set(lab_dict), key=lambda x: (-(lab_sent[x] + lab_dict[x]), x.lower())):
        low = lab.lower()
        if low in LABELS:
            prop, abbr, note = LABELS[low]
        elif low in NO_PROPOSAL:
            prop, abbr, note = "", "", NO_PROPOSAL[low]
        elif PRONOUN.match(low):
            prop, abbr, note = std_pronoun(lab), std_pronoun(lab).upper(), ""
        else:
            prop, abbr, note = lab, "", "English gloss, no change proposed"
        rows.append({"label as written": lab, "in sentences": lab_sent[lab], "in dictionary": lab_dict[lab],
                     "used for": ", ".join(f"{f} ×{n}" for f, n in used_for[lab].most_common(6)),
                     "proposed label": prop, "abbreviation": abbr,
                     "change?": "" if prop == lab else ("no proposal" if not prop else "yes"),
                     "note": note, "decision": "", "your abbreviation": "", "your note": ""})
    write_tsv(review_dir / "gloss_labels.tsv",
              ["label as written", "in sentences", "in dictionary", "used for", "proposed label", "abbreviation",
               "change?", "note", "decision", "your abbreviation", "your note"], rows,
              key=lambda r: r["label as written"])

    # 2. morphemes: conflicting glosses, differences from the dictionary, unlinked, unglossed
    loose = lambda f: re.sub(r"(.)\1+", r"\1", re.sub(r"[:̣]", "", f.lower()))
    exact_forms, same_form = defaultdict(set), defaultdict(list)
    for c in entries.values():
        for f in [c["hw"], c["lc"]] + [v[0] for v in c["va"]] + c["orig"]:
            for part in re.split(r"\s*,\s*", f or ""):
                if part:
                    exact_forms[c["id"]].add(part.lower())
                    if c["senses"] and c not in same_form[loose(part)]:
                        same_form[loose(part)].append(c)
    groups = defaultdict(lambda: {"g": Counter(), "refs": []})
    for s in sents:
        if not s["a"]:
            continue                                   # no gloss lines: listed in sentences_without_glosses.tsv
        for f, g, i in s["m"]:
            if f in UNGLOSSED:
                continue
            grp = groups[(f, i)]
            grp["g"][g.strip()] += 1
            if len(grp["refs"]) < 4:
                grp["refs"].append(ref(s))
    rows = []
    for (f, i), grp in groups.items():
        glossed = Counter()
        for g, n in grp["g"].items():
            if g not in UNGLOSSED:
                glossed[standard(g)] += n
        unglossed = sum(n for g, n in grp["g"].items() if g in UNGLOSSED)
        issues, prop, link = [], "", ""
        c = entries.get(i)
        dict_gl = [standard(g) for g in glosses(c)] if c else []
        others = same_form.get(loose(f), [])
        if not c and others:
            issues.append("gloss doesn't match the dictionary entry with this spelling" if glossed
                          else "not linked: no gloss, and more than one entry has this spelling")
        elif not c:
            issues.append("no dictionary entry with this spelling")
        if not c:
            top = glossed.most_common(1)[0][0] if glossed else ""
            near = [x for x in entries.values() if top and x["senses"]
                    and any(edit1(f.lower(), p) for p in exact_forms[x["id"]])
                    and (top.lower() in [standard(g).lower() for g in glosses(x)])]
            if len(near) == 1:
                link = shown(near[0]) + (near[0]["hm"] or "")
                issues[-1] += f"; same gloss under {shown(near[0])}"
        else:
            if f.lower() not in exact_forms[i]:
                issues.append(f"spelled {f} here, {shown(c)} in the dictionary")
            off = [g for g in glossed if g.lower() not in [d.lower() for d in dict_gl]
                   and not set(re.findall(r"[a-z0-9.]+", g.lower())) & set(re.findall(r"[a-z0-9.]+", " ".join(dict_gl).lower()))]
            if off:
                issues.append("gloss differs from the dictionary")
        if len(glossed) > 1:
            issues.append("glossed in different ways")
        if unglossed:
            issues.append(f"unglossed ×{unglossed}")
        if not issues:
            continue
        if len(glossed) > 1 and c and all(g.lower() in [d.lower() for d in dict_gl] for g in glossed):
            issues = [x for x in issues if x != "glossed in different ways"] or ["different senses of the same entry"]
            if issues == ["different senses of the same entry"]:
                continue                                  # e.g. -andru ablative/instrumental/ergative: all in the dictionary
        rows.append({"morpheme": f, "dictionary entry": (shown(c) + (c["hm"] or "")) if c else "",
                     "dictionary gloss": "; ".join(glosses(c)) if c else
                     " | ".join(f"{shown(x)}{x['hm'] or ''}: {'; '.join(glosses(x))}" for x in others),
                     "glosses in sentences": "; ".join(f"{g or '(none)'} ×{n}" for g, n in grp["g"].most_common()),
                     "count": sum(grp["g"].values()), "issue": "; ".join(issues), "proposed gloss": prop,
                     "proposed link": link, "decision": "", "link to": "", "your note": "",
                     "example sentences": ", ".join(grp["refs"])})
    rows.sort(key=lambda r: (-r["count"], r["morpheme"]))
    write_tsv(review_dir / "gloss_by_morpheme.tsv",
              ["morpheme", "dictionary entry", "dictionary gloss", "glosses in sentences", "count", "issue",
               "proposed gloss", "proposed link", "decision", "link to", "your note", "example sentences"],
              rows, key=lambda r: (r["morpheme"], r["dictionary entry"]))

    # 3. sentences with no gloss lines
    rows = [{"sentence": ref(s), "Kullilli": s["v"], "translation": " / ".join(s["ft"])}
            for s in sents if not s["a"]]
    write_tsv(review_dir / "sentences_without_glosses.tsv", ["sentence", "Kullilli", "translation"], rows,
              key=lambda r: r["sentence"])
    return review_dir


# ---- applying decisions ---------------------------------------------------------------
def decided(row, proposed_col):
    d = (row.get("decision") or "").strip()
    if d.lower() in ("y", "yes"):
        return (row.get(proposed_col) or "").strip()
    if d.lower() in ("", "n", "no"):
        return ""
    return d


def apply(sents, entries, review_dir):
    """Put Claire's decisions into the site data. Returns (labels changed, morphemes changed)."""
    review_dir = Path(review_dir)
    labels = {}
    for r in read_tsv(review_dir / "gloss_labels.tsv"):
        new = decided(r, "proposed label")
        if new and new != r["label as written"]:
            labels[r["label as written"]] = new
    by_form = defaultdict(list)
    for c in entries.values():
        for key in {(c["lc"] or c["hw"]).lower() + (c["hm"] or ""), (c["lc"] or c["hw"]).lower()}:
            by_form[key].append(c)
    morph = {}
    for r in read_tsv(review_dir / "gloss_by_morpheme.tsv"):
        new = decided(r, "proposed gloss")
        target = (r.get("link to") or "").strip()
        if target.lower() in ("y", "yes"):
            target = (r.get("proposed link") or "").strip()
        tc = by_form.get(target.lower(), [])
        if new or len(tc) == 1:
            morph[(r["morpheme"], r["dictionary entry"])] = (new, tc[0]["id"] if len(tc) == 1 else None)
    shown = lambda c: c["lc"] or c["hw"]
    n_lab = n_m = 0
    for s in sents:
        for m in s["m"]:
            c = entries.get(m[2])
            key = (m[0], (shown(c) + (c["hm"] or "")) if c else "")
            if key in morph:
                new, link = morph[key]
                m[1], m[2] = new or m[1], link or m[2]
                n_m += 1
            if m[1].strip() in labels:
                m[1] = labels[m[1].strip()]
                n_lab += 1
    for c in entries.values():
        if c["cls"] in ("suffix", "prefix", "clitic", "pronoun"):
            for sense in c["senses"]:
                sense["gl"] = [labels.get(g.strip(), g) for g in sense["gl"]]
    return n_lab, n_m
