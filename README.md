# Kullilli dictionary website

A static Kullilli–English dictionary with recordings and interlinear example sentences.
It works on phones as well as computers. The website itself is in `docs/` and is published
with GitHub Pages.

## Layout

```
kullilli/                     this repository
  docs/                       the website (published by GitHub Pages)
  build/                      the scripts that make docs/ from the source material
  README.md

KullilliDictionary/           source material, kept outside the repository (next to it)
  data/Kullilli.lift          FLEx LIFT export (+ Kullilli.lift-ranges)
  data/audio/                 recordings referenced in the LIFT
  data/Kullilli sentences.docx  interlinear sentences (FLEx export, edited in Word)
  review/                     glossing review files written by the build
```

## Rebuild after a new FLEx export or sentence edits

Export LIFT from FLEx into `KullilliDictionary/data/` (replacing `Kullilli.lift` and `audio/`),
edit `Kullilli sentences.docx` as needed, then from this folder run:

```
python3 build/build_lift.py
```

If the source material is somewhere other than `../KullilliDictionary`, give its folder:
`python3 build/build_lift.py /path/to/KullilliDictionary`.

The build needs plain Python 3, with no extra packages. It:
- rewrites `docs/data/dictionary.js` and copies the recordings the dictionary uses into `docs/audio/`;
- stamps each script and stylesheet link in `docs/index.html` with a fingerprint (`app.js?v=…`),
  so browsers pick up new versions straight away;
- writes the glossing review files to `KullilliDictionary/review/` (see below);
- reports any recording the LIFT refers to that is missing from `audio/`.

Rebuilding unchanged material produces identical files, so git only shows real changes.
Then commit and push `docs/` (and `build/` if the scripts changed).

## Preview locally

Run `python3 -m http.server 8803 --directory docs` and go to http://localhost:8803.
To try it on a phone on the same wi-fi, use the computer's address instead of localhost.

## Publish on GitHub Pages

On GitHub: Settings → Pages → Build and deployment → "Deploy from a branch", then choose the
branch and the `/docs` folder. `docs/.nojekyll` tells Pages to serve the files as they are.
The recordings come to about 40 MB, which is fine for Pages.

## What goes on the site (settings at the top of `build/build_lift.py`)

- Headword: the lexeme form, or the citation form when FLEx has one (e.g. *garta* for *gartalingu*).
  The headword's recording comes from the lexeme or citation audio.
- Senses: gloss, definition, examples with free translation.
- Meaning, grammar and sociolinguistics notes appear under the meaning. Phonology notes and untyped notes
  appear under "Notes, etymology and sources" (`SHOW_UNTYPED_NOTES = True`; set it to False to leave
  untyped notes out).
- Sources: the sense `source` notes and the entry's dialect labels, merged into one list.
- Variants: variant entries ("minor entries") link to their main entry, and the main entry lists them,
  each with its own recording. `<variant>` forms are listed too.
- Complex forms ("Made from" / "Used in"), Compare ("See also") and minimal pairs link entry to entry.
- "Original Orthography" is shown as *Original spelling* and is searchable.
- Semantic domains and reversal entries are kept in the data. Reversals feed the English search;
  domains are kept for a future topic browser.
- Letters: `DIGRAPHS` (dh dy ng nh ny th ty) get their own tabs. `SPELLING` lists the
  "similar spelling" rules for search.

## Example sentences (`build/sentences.py`)

- Each sentence's lines are read in order: words, morphemes, FLEx entry line (later texts),
  morpheme glosses, categories, then word glosses and word categories. `Free` lines are the
  translation. `Note` lines and Word comments become linguist notes, which are hidden on the site
  until someone ticks "Show linguist notes and questions" in an entry.
- Each morpheme is linked to its dictionary entry. The sentence gloss decides between entries with
  the same spelling, and FLEx homograph numbers only break ties. A spelling with rr/r or
  long-vowel differences is tried if the exact one has no matching gloss.
- Each entry shows the sentences that use it. LIFT examples that are one of these sentences appear in
  interlinear form under their meaning. The rest appear under "More examples": 3 shown, the rest behind
  "Show more", shortest first.
- Grammatical labels are shown as small-caps abbreviations (food-ACC, 1SG.ERG). Hovering or tapping
  shows the full name, and the About page lists them all.

## Glossing review (`build/glosscheck.py`)

Every build rewrites these files in `KullilliDictionary/review/`:

| File | What's in it |
|---|---|
| `gloss_labels.tsv` | every grammatical label as written, how often, on which forms, a proposed standard label and its abbreviation |
| `gloss_by_morpheme.tsv` | morphemes glossed in different ways, spelled differently from the dictionary, not matching the dictionary, not in the dictionary, or unglossed |
| `sentences_without_glosses.tsv` | sentences that have no gloss lines in the docx |
| `unlinked_morphemes.tsv` | sentence morphemes not matched to a dictionary entry |

The **decision**, **link to**, **your abbreviation** and **your note** columns are kept when the files are
rewritten, and the build applies what's in them:

- `y`: use the proposed label or gloss (in **link to**: use the proposed link)
- any other text: use that instead (in **link to**: a headword, with its homograph number if needed, e.g. `garri2`)
- empty or `n`: leave as it is

Decisions change the website only; the docx and the LIFT are not touched. Save the files as
tab-separated text, not .xlsx.

## Files

| File | What it does |
|---|---|
| `build/build_lift.py` | source material → `docs/data/dictionary.js` + `docs/audio/` |
| `build/sentences.py` | reads the interlinear sentences from the docx |
| `build/glosscheck.py` | glossing review files, abbreviations, applying review decisions |
| `docs/index.html` | page shell; the About text is in the `<template id="about-tpl">` near the end |
| `docs/style.css` | styles, including the phone layout |
| `docs/search.js` | Kullilli (spelling-tolerant) and English (stemmed, typo-tolerant) search |
| `docs/render.js` | cards, list rows, interlinear examples and entry HTML; part-of-speech labels |
| `docs/app.js` | wordlist, affixes, search page, entry panel, audio player, URL routing |
