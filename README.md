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

## Learn tab (`docs/games/`)

Each game is its own file in `docs/games/` (`<name>.js`, plus `<name>.css` if it has its own styles). Shared parts
are in `core.js` and `games.css`: the word picker, topics, the settings bar, the end-of-round panel, the letters
and keyboard, and tricky words. The build writes the links to every file in `docs/games/` into `index.html`,
so **to remove a game, delete its files and rebuild**; to add one, add its files (it calls
`DictGames.register({ id, group, order, title, desc, run })`) and rebuild. `group` puts it in a section of the
Learn page: Every day, Words and meanings, Listening, Spelling.

All games work with a mouse, a keyboard, a touch screen or a screen reader:

- **Keyboard.** Every button can be reached with Tab and pressed with Enter or Space. After a move redraws the
  board, focus stays where the player was (or goes to the next word, Next, or Play again), so keyboard and
  screen-reader users don't lose their place. Mouse and touch players don't get focus moved for them. Drag games
  (Match up, Sort into groups) also work by pressing one item and then the other, and Word search letters can be
  moved between with the arrow keys and chosen with Enter.
- **Spoken results.** Each game has a hidden live region (`say()` in `core.js`) that reads out results ("Not right.
  wiyi means fire."), the score line, what was selected, and each letter typed. Letter states (in the word / somewhere
  else / not in the word) and blank boxes are also given as hidden text, not only as colours.
- **Sound.** "Play sounds automatically" in each game's settings bar (on by default) can be switched off so that
  recordings don't talk over a screen reader; every recording also has its own labelled play button. Nothing in
  the games is timed: Memory pairs keeps a wrong pair face up until the next card is turned, and Word in the middle
  waits for Next.
- **Language.** Kullilli words are marked `lang="gll"` (the code comes from the FLEx writing system and is in the
  data as `langCode`), so screen readers don't read them with English pronunciation rules.
- **Looks.** Text and control colours meet the WCAG contrast levels (4.5:1 for text, 3:1 for controls); right and wrong
  answers also get ✓ / ✗ and a solid or dashed border; animations are switched off for people whose system is set to
  reduce motion. The page title names the game being played.

**Every day**
- **Daily five** (`daily`): five quick questions, the same for everyone on a given day (picked from the date):
  meaning of a word, word for a meaning, hear and choose. Progress and a day streak are kept on the device.

**Words and meanings**
- **Memory pairs** (`memory`): 6 pairs face down. Cards: word & meaning, sound & word, or sound & meaning (a sound
  card plays when turned over).
- **Match up** (`match`): drag each word onto its meaning (or the other way round); on a phone, tap one then the other.
- **Word in the middle** (`circle`): a word in the centre and six meanings round it (or the reverse); 10 questions.
- **Odd one out** (`odd`): four words, three from one topic (a specific FLEx domain such as Bird or Body) and one
  from a different top-level domain; afterwards all four meanings are shown.
- **Sort into groups** (`sort`): drag words (or tap a word, then a basket) into baskets for two or three topics
  from different top-level domains, so no word fits two baskets. "Show meanings" is a hint.
- **Word search** (`wordsearch`): six topic words hidden across, down or diagonally in an 8×8 grid of Kullilli
  letters (ng, dh … fill one cell; filler letters in their dictionary proportions). Clues are the Kullilli words
  or their English meanings. Drag across a word or tap its first and last letters (arrow keys + Enter on a keyboard).

**Listening**
- **Listen and choose** (`listen`): hear a word, pick it from four by spelling or meaning. *Easy*: the others are
  at least 3 letters different and start differently. *Harder*: the closest-sounding words, usually minimal and
  near-minimal pairs (*thaya* 'mouth' / *dhaya* 'stars'). The word heard is from the chosen topic; the others from
  anywhere, never a variant spelling or a same-meaning word. After answering, every choice can be played.
- **Same or different?** (`same`): two recordings, the same word twice or a minimal pair (one Kullilli letter apart;
  never two spellings of one word). Practise one kind of difference: vowels; b/p, d/t, g/k…; r/rr; d/rd, n/rn…;
  d/dh, n/nh…; d/dy, n/ny… Afterwards both words are shown, with the letters that differ, and can be replayed.
  This assumes the recordings make these contrasts consistently.

**Spelling** (these use the alphabet set by `KEYBOARD` in `build/build_lift.py`; ng, dh, rr … are one letter)
- **Unscramble** (`unscramble`): tap shuffled letter tiles into order; clue is the meaning or the recording.
- **Spell it** (`spell`): hear a word and type it; Check marks each letter; "Show me" after a wrong try.
- **Letter by letter** (`letters`): pick letters to fill in a hidden word, with no penalty; meaning and recording as hints.
- **Hidden word** (`hidden`): guess a 4–6 letter word in six tries, with right-place / elsewhere / not-in-word tiles.

**Words used.** Nouns, verbs, adjectives, adverbs, interjections and similar words with a short, certain gloss (no
"?", no "unknown"); no affixes, pronoun labels, place names or variant spellings; a round never has two words with
the same gloss. Players choose a topic (FLEx semantic domains, including subdomains, with at least 6 words) and
whether to use only words with recordings. Rounds end with cards for the words played, linked to their entries.

**Tricky words.** A word answered wrongly in Match up, Word in the middle, Listen and choose, Hidden word,
Unscramble, Spell it, Sort into groups, Word search or Daily five goes on the player's tricky list; two right
answers in a row take it off. "★ My tricky words" is then a topic in every game, and the Learn page links to the
list (with a Clear button). Memory pairs, Letter by letter, Odd one out and Same or different? don't add words:
a wrong turn there is about memory, categories or hearing rather than knowing the word. The list, settings and
the daily streak are kept in the browser on that device only (localStorage); nothing is sent anywhere.

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
| `docs/games/core.js`, `games.css` | the Learn tab's shared parts and the game registry |
| `docs/games/<name>.js`, `<name>.css` | one game each (see the Learn tab section) |
| `docs/app.js` | wordlist, affixes, search page, entry panel, audio player, URL routing |
