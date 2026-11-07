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

## Learn tab (`docs/games.js`)

Six games, all usable with a mouse, a keyboard or a touch screen:

- **Memory pairs**: 6 pairs face down; turn over two cards at a time to match a word with its meaning.
- **Match up**: drag each word onto its meaning (or the other way round); on a phone, tap one and then the other.
- **Word in the middle**: a word in the centre and six meanings in a circle round it (or the reverse); 10 questions.
- **Listen and choose**: a recording plays (tap the big speaker to hear it again); pick the word from four,
  either by its spelling or by its English meaning. *Easy*: the other three are at least 3 letters different
  and start with a different letter. *Harder*: the other three are the closest-sounding words, usually 1–2
  letters away (minimal and near-minimal pairs, e.g. *thaya* 'mouth' / *dhaya* 'stars'), counting Kullilli
  letters (ng, dh … are one letter). The word heard comes from the chosen topic and always has a recording;
  the other choices come from anywhere in the dictionary, but never a variant spelling of the answer or a word
  with the same meaning. After each answer every choice shows its meaning (or spelling) and can be played,
  so the sound-alikes can be compared. 10 questions.
- **Letter by letter** (the easier word puzzle): boxes for a hidden 4–6 letter word and the alphabet; each letter
  picked either fills its boxes or is greyed out, with no limit and no penalty. "Show the meaning" and "Listen"
  (the recording) are hints. Single letters can also be typed; two-letter ones (ng, dh …) are on-screen keys.
- **Hidden word**: guess a 4–6 letter word in six tries. After each guess, tiles show letters in the right place
  (blue), in the word but somewhere else (ochre, dashed) and not in the word (grey). Letters are Kullilli
  letters, so *ng*, *dh*, *rr* and the like are one tile each. The on-screen keyboard is the alphabet from the
  sketch grammar, set by `KEYBOARD` in `build/build_lift.py`; typing *n* then *g* (on screen or on a computer
  keyboard) makes *ng*. Guesses that are real words show their meaning, there's a "Show the meaning" hint,
  and the end of a round plays the word and links to its entry.

Words in the games are nouns, verbs, adjectives, adverbs, interjections and similar words with a short, certain
gloss (no "?", no "unknown"). Affixes, pronoun labels, place names and variant spellings are left out, and each
round uses different glosses so the pairs are never ambiguous. Players can choose a topic (the FLEx semantic
domains, a domain including its subdomains, those with at least 6 words), limit the games to words with
recordings (the recording plays on each correct match), and set the direction. Each round ends with cards for
the words played, which link to their entries.

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
| `docs/games.js` | the Learn tab: word picker, memory pairs, match up, word in the middle, listen and choose, letter by letter, hidden word |
| `docs/app.js` | wordlist, affixes, search page, entry panel, audio player, URL routing |
