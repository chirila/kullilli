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
  data/lexicon/               master copy of the dictionary, kept by the dictionary editor
    texts/                    interlinear sentences (read by the build)
  data/Kullilli.lift          LIFT export of the master copy, written by the editor (+ .lift-ranges)
  data/audio/                 recordings referenced in the LIFT
  review/                     glossing review files written by the build
```

## Rebuild after editing the dictionary

The dictionary is no longer edited in FLEx (since 2026-11-07): the master copy is in
`KullilliDictionary/data/lexicon/`. Write the LIFT file from it (in `KullilliDictionary/`:
`python3 editor/json2lift.py`), then from this folder run:

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

## Offline use and installing as an app

`docs/sw.js` (a service worker) saves the site the first time it is opened: every file `index.html` loads, as
listed by the build (`write_service_worker()` rewrites the list between `// <assets>` markers, with a version
that changes whenever any file does). Pages come from the network when online and from the saved copy when not;
scripts, styles and data come from the saved copy (their `?v=` fingerprints change when they change). A new
version replaces the old saved copy as a whole. Recordings are saved in a separate store (`recordings`) as they
are played, and kept across updates; the About page's "Using the dictionary offline" has **Save all recordings**
(869 files, about 40 MB, with progress) and **Remove saved recordings**, and says how many are saved. Sound files
are served in parts when the browser asks (Safari needs this). `docs/manifest.webmanifest` and `docs/icons/`
(made from `kullillidictionary.png`, corners filled with its red) let phones add the site to the home screen as
an app. Nothing to do when publishing: rebuilding updates the list.

**Last updated.** The About page says "Last updated 7 November 2026. The words were last edited on 10 August
2023." The first date is the day of the last build that changed anything on the site (kept in `sw.js` as `UPDATED`
and in `index.html` as `<meta name="site-updated">`; a rebuild with no changes keeps the old date, so files stay
the same). The second is the newest "date modified" of any entry in the LIFT export (`edited` in the data).

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
- Semantic domains and reversal entries are kept in the data. Reversals feed the English search and the
  English-first wordlist; domains are the topics (By topic in the Wordlist, topic links on entries, the games).
- `SKIP_ENTRIES` leaves entries out of the site: `aaa`, FLEx's "how to use the dictionary" record, whose text is
  now on the About page.
- Letters: the digraphs (dh dy ng nh ny th ty) get their own tabs, and the spelling key lists the
  "similar spelling" rules for search. Both are in `KullilliDictionary/data/lexicon/settings.json`
  (shared with the dictionary editor), with the alphabet.

**By topic.** The third choice on the Wordlist switch (`#/topic`) lists the FLEx semantic domains (DDP4) used in
the data, under their top-level domain (Universe, creation; Person; …), indented by level, with word counts. A
topic page (`#/topic/1.6.1.2`) has a trail back up (All topics › Universe, creation › Animal › Types of animals),
buttons for its smaller topics, the usual word-type filters and Cards/List switch, and the entries: a topic
includes its smaller topics. A domain's parent is the nearest shorter code in the data; top-level names come from
DDP4 if FLEx has none. "Words without a topic" (`#/topic/none`) lists the rest. Each entry shows its topics as
links under the word type.

**English-first wordlist.** The Wordlist tab has a switch, "Kullilli → English" / "English → Kullilli" / "By topic"
(`#/letter/b` / `#/english/b` / `#/topic`); the site remembers which one was used last. In both letter lists,
**All** before the letters (`#/letter/all`, `#/english/all`) shows every word in alphabetical order (1,106 Kullilli
entries, 1,491 English cards, pronoun labels last); cards are drawn in chunks as you scroll. The English list has the
English alphabet A–Z along the top (letters with no words are greyed out) and # for pronoun labels such as
*1sg.nom*. Each card leads with the English word, then the Kullilli word, its word type, its recording and
bookmark, and its full gloss when that says more than the English word. Opening a card opens the full
Kullilli entry, with examples, as in the Kullilli list, and Previous/Next follow the English order. The same
word-type filters and Cards/List switch apply.

The English words are FLEx's English reversal index (in FLEx: the Reversal Indexes view), one card per
English word and entry; an entry with no reversal uses its glosses (split at ";"). Reversals with "?" or
"unknown" are left out. Reversals that FLEx uses as categories come through as they are, so "birds" (50
words), "grammar" (77), "pronouns" (42) and "animals" (13) each list every entry tagged with them; edit or
remove them in the dictionary to change that. Built in `app.js` (`engIndex`).

## English suggestions (`build/suggest.py`)

Every search looks at Kullilli words, English meanings and the example sentences at once. Words found only in an
example are folded away under each list ("62 more in example sentences · Show", a `details.ex-hits` in
`viewSearch`); when a list has nothing else, that part starts open ("Only in example sentences"). (The Both / Kullilli / English buttons and the "search in
examples" and "suggest related English words" tick boxes were removed on 2026-11-07 to make the phone view less
crowded; old settings saved on a device are ignored.)

When a search finds fewer than three words by their English meanings (words found only in examples don't count),
the results page offers related English words that are in the dictionary: "Try a related word: child" for *infant*,
"pup · dog" for *puppies*, "car" for *automobile*. Tapping one searches for it. The About page explains it.

The build makes `docs/data/suggest.js` (about 150 KB, ~7,900 English words) from the WordNet 3.1 database files in
`Documents/Claude/Wordnet_dict` (`WORDNET` in `build/build_lift.py`). For each searched word not already in the
dictionary's English, it takes WordNet's commonest senses (nouns first) and keeps synonyms, then broader and similar
words, that the search can find. Left out: narrower words, broader words for verbs, very general words, and names
of places and people. The site loads the file only when a search needs it, and it is saved for offline use. If
WordNet isn't on the computer that runs the build, the existing file is kept.

## Look

Colours come from the red dictionary logo (`KullilliDictionary/kullillidictionary.png`): a red header with a row of
dots along the top (like the dotted line in that logo), and red-brown headings and Kullilli words. They are set at the
top of `docs/style.css` (`--sea`, `--sea2`, `--link`, `--head1`, `--head2`, `--logo-red`).

The logo itself is now the black-and-white "kullilli ngulkana / learning kullilli" logo (`docs/icons/ngulkana-*.png`,
cut from `kullilli ngulkana app store logo.png`). In the header it sits with the title "Kullilli Dictionary" on a
light clay panel (`.brand-panel` in `docs/style.css`, `--clay: #ecc0ab`), so it shows up on the red; the panel
covers only the logo and title, not the whole header. On phones the logo is 40 px and the title smaller, so the
header is just the logo panel, the search box and the tabs.

The word of the day (top of the Wordlist) folds away: tapping its heading line hides it down to one line ("Word of
the day: wirlidhi · Show"), and the site remembers open or folded on the device (`details.wotd-box`, store key
`wotd`).

| File | Used for |
|---|---|
| `ngulkana-160.png` | header logo (shown at 80 px, 40 px on phones; round, see-through corners) |
| `ngulkana-192.png`, `ngulkana-512.png` | browser tab, installed app (round, see-through corners) |
| `ngulkana-180.png` | iPhone/iPad home screen (white square; iOS rounds the corners) |
| `ngulkana-maskable-512.png` | Android home screen (logo inside the middle 80%, which Android crops to its own shape) |

They are named in `docs/index.html`, `docs/manifest.webmanifest` and `extra` in `build/build_lift.py` (offline
list). The earlier red icons (`icon-*.png`, `apple-touch-icon.png`, `logo-144.png`) are no longer used.

## Example sentences (`KullilliDictionary/data/lexicon/texts/`)

- The sentences come from the dictionary editor's text files (until 2026-11-07, from the Word file
  `Kullilli sentences.docx`): words, morphemes with their glosses, categories and FLEx entry line,
  and the translation. Notes and Word comments become linguist notes, which are hidden on the site
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
  recordings don't talk over a screen reader; every recording also has its own labelled play button. Automatic
  sounds start 300 ms after the screen changes (`AUTO_DELAY` in `core.js`); paging on quickly, pressing a play
  button or leaving the game cancels one that hasn't started. Nothing in
  the games is timed: Memory pairs keeps a wrong pair face up until the next card is turned, and Word in the middle
  waits for Next.
- **Language.** Kullilli words are marked `lang="gll"` (the code comes from the FLEx writing system and is in the
  data as `langCode`), as WCAG asks for text in another language. No screen reader has a Kullilli voice, so they
  fall back to the reader's default voice (usually English) and say the words much as they would without the tag;
  the recordings are the way to hear them properly. The tag mainly tells software that these words aren't English.
  They are also marked `translate="no"`, so browser page translation (e.g. English → Spanish) leaves them as they
  are. Hidden screen-reader text inside them ("blank", "in the word") stays marked as English and translatable.
  This marking is done in `app.js` (`markLang`) for every page, not only the games.
- **Looks.** Text and control colours meet the WCAG contrast levels (4.5:1 for text, 3:1 for controls); right and wrong
  answers also get ✓ / ✗ and a solid or dashed border; animations are switched off for people whose system is set to
  reduce motion. The page title names the game being played.

**Every day**
- **Daily five** (`daily`): five quick questions, the same for everyone on a given day (picked from the date):
  meaning of a word, word for a meaning, hear and choose. Progress and a day streak are kept on the device.
- **Flashcards** (`flashcards`): 10 cards by default (5, 20, 30 or 50 to choose). The front shows the Kullilli
  word (with its recording) or, with "English → Kullilli", the English meaning. Click or tap the card, or press
  Enter, to turn it over. The back has the other language, the word type, an example sentence with its translation
  (a sense example, or else a text sentence that uses the word) and a link to the entry. Both sides have
  the study-list bookmark (its spoken label doesn't name the word, so it can't give the answer away). Under a
  turned card, "Did you know it? ✓ Got it / Still learning" (once per card per round) goes on to the next card:
  Still learning puts the word on the tricky list, Got it counts as a right answer. With English first, the
  recording is on the back. Arrow keys go to the previous or next card. With "Which words: Studied before" (see
  Practised words), the cards are the words practised longest ago. Cards per round is `g.fcards`. A card counts as
  studied the first time it is turned over in a round: that adds to the flashcard count for the day (store
  `flash`, one number per date) and marks the word as practised. The game shows the words studied with
  flashcards today, this week (from Monday), this month and this year.

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

**Spelling** (these use the alphabet in `KullilliDictionary/data/lexicon/settings.json`; ng, dh, rr … are one letter)
- **Unscramble** (`unscramble`): tap shuffled letter tiles into order; clue is the meaning or the recording.
- **Spell it** (`spell`): hear a word and type it; Check marks each letter; "Show me" after a wrong try.
- **Letter by letter** (`letters`): pick letters to fill in a hidden word, with no penalty; meaning and recording as hints.
- **Hidden word** (`hidden`): guess a 4–6 letter word in six tries, with right-place / elsewhere / not-in-word tiles.

**Words used.** Nouns, verbs, adjectives, adverbs, interjections and similar words with a short, certain gloss (no
"?", no "unknown"); no affixes, pronoun labels, place names or variant spellings; a round never has two words with
the same gloss. Players choose a topic (FLEx semantic domains, including subdomains, with at least 6 words) and
whether to use only words with recordings. Rounds end with cards for the words played, linked to their entries.

**Tricky words.** A word answered wrongly in Match up, Word in the middle, Listen and choose, Hidden word,
Unscramble, Spell it, Sort into groups, Word search or Daily five, or marked "Still learning" on a flashcard,
goes on the player's tricky list; two right
answers in a row take it off. "★ My tricky words" is then a topic in every game, and the list is on the My lists
tab (`#/mylist/tricky`; the Learn page links to it). Memory pairs, Letter by letter, Odd one out and Same or different? don't add words:
a wrong turn there is about memory, categories or hearing rather than knowing the word.

**My study list.** Every word card, list row and entry has a bookmark button (`data-study`; aria-pressed) that
adds the word to the reader's study list or takes it off. "My study list" is a topic in every game.

**My lists tab** (`#/mylist`; tabs: Wordlist, Learn, My lists, Affixes, and About on the far right). One page with
jump links at the top to its four sections, each with its own address: *My study list* (`#/mylist/study`: the
words, newest first, each with how often it has been practised; save, clear, share), *★ My tricky words*
(`#/mylist/tricky`: most-missed first; save, clear), *Practice so far* (`#/mylist/practice`) and *Back up your
data* (`#/mylist/backup`). The Learn page links to the two lists; the older `#/learn/study` and `#/learn/tricky`
addresses open the same page. Words
the games can't use (variants, affixes, no short meaning) can be bookmarked too; the page says how many of these
there are. The list is kept in `app.js` (`study`) and handed to the games as `ctx.study`; the page itself is drawn
by `DictGames.myList()` (`listsPage`) in `core.js`, since it uses the games' word picker and practice counts.

**Sharing a list.** "Share this list" on the study list page makes a link with the words and an optional name,
e.g. `…/#/shared/Week%203%3A%20animals/babadya,baka.1,bagarri` (name, then entry ids; it opens under the My lists
tab). Older `#/learn/list/…` addresses still work. On a phone it opens the
system share sheet; elsewhere it copies the link (and shows it for copying by hand). Whoever opens the link sees
the words as cards and can add them all to their own study list, or replace their list with them; ids no longer
in the dictionary are skipped and counted. The link is the whole list: nothing is stored on a server. Entry ids
come from the headword and homograph number, so a link made now may lose or change a word if a headword is
respelled or homographs are renumbered in FLEx.

**Practised words.** Every word shown at the end of a round the player finishes counts as practised once, with
the date (`practise()` in `core.js`; Letter by letter and Hidden word, which end on a single word, count that
word; Flashcards count a word when its card is turned). The study list page shows "You have practised N of the M
words used in the games", with a button to forget the history. Words from rounds left half-way don't count.

**Which words.** Every game's settings bar (all but Daily five and Same or different?) has *Any words* /
*New to me* / *Studied before*, on top of the topic. New = never practised anywhere on the site; studied before
= practised in any game or in flashcards, so it means "words I know", not "words seen in this game". It is one
setting (`g.which`) shared by all games, and the topic counts follow it. This replaced the earlier "Not
practised yet" topic; a saved choice of that topic becomes *New to me*.

The study list, practice history, flashcard counts, tricky list, settings and the daily streak are kept in the browser on that
device only (localStorage); nothing is sent anywhere, so the site owner can't see what people study, and a
reader's lists don't follow them to another phone or browser.

**Saving lists.** "Save as a spreadsheet" under each list on My lists downloads a CSV file
(`kullilli-study-list-<date>.csv`, `kullilli-tricky-words-<date>.csv`): the word (with homograph number), word type,
English meaning, one example with its translation, times practised (study list) or times missed (tricky words),
and a link to the entry. It starts with a byte-order mark so Excel shows accented letters correctly; Numbers,
Google Sheets and flashcard apps such as Anki can open or import it.

**Backup and restore.** "Back up your data" on the My lists page saves everything the site keeps in the browser
(every `Kullilli.*` localStorage key: lists, practice history, flashcard counts, daily streak, settings) to
`kullilli-dictionary-backup-<date>.json`. "Restore from a backup…" reads such a file, checks that it is a backup
from this dictionary (`backup: "dictionary-site-data"`, same language, plain text values only), says what it holds
and asks before replacing everything in the browser, then reloads the page. This is also how a reader moves their
data to another device. Code: `store.dump()` / `store.load()` in `app.js`, the page parts in `core.js`.

## Feedback (`.github/ISSUE_TEMPLATE/`)

Readers send feedback as GitHub issues, through three forms:
- `1-word.yml`, **Comment on a word or meaning** (label `word`): word, link, what the dictionary says now, what the
  comment is about (meaning, spelling, recording, example, something to add, other), the comment, and an optional
  "Where does this come from?".
- `2-problem.yml`, **Something isn't working** (label `bug`): what happened, what was expected, page, device and browser.
- `3-idea.yml`, **Idea for a feature or activity** (label `enhancement`): kind of idea, the idea, who it would help.

On the site, the footer of every page links to **Send feedback** (`#/feedback`), and so does the About page. Every
entry ends with "Comment on this word or its meaning" (`#/feedback/word/<id>`), which shows the word's card and
fills in the word, its link and its current meaning. "Report a problem" fills in the page the reader came from and
their browser and screen size. The buttons open the GitHub form in a new tab; the page says that a free GitHub
account is needed and that what people write is public.

Settings at the top of `build/build_lift.py`: `FEEDBACK_REPO` ("owner/repository"; empty = worked out from the
github.io address, so the buttons only show on the published site) and `FEEDBACK_EMAIL` (optional). With an
address set, each form also gets an **Email instead** button for people without a GitHub account: it opens the
reader's email app with a subject (e.g. "Kullilli Dictionary: comment on baka (1)") and the same questions in the
body, with the word, link and meaning (or page and device) filled in. The address is visible in the site's files. On GitHub, Issues must be switched on for the repository (they
are by default); the `bug` and `enhancement` labels exist by default, and `word` is added to an issue only once a
label of that name has been created.

## Glossing review (`build/glosscheck.py`)

Every build rewrites these files in `KullilliDictionary/review/`:

| File | What's in it |
|---|---|
| `gloss_labels.tsv` | every grammatical label as written, how often, on which forms, a proposed standard label and its abbreviation |
| `gloss_by_morpheme.tsv` | morphemes glossed in different ways, spelled differently from the dictionary, not matching the dictionary, not in the dictionary, or unglossed |
| `sentences_without_glosses.tsv` | sentences that have no glosses |
| `unlinked_morphemes.tsv` | sentence morphemes not matched to a dictionary entry |

The **decision**, **link to**, **your abbreviation** and **your note** columns are kept when the files are
rewritten, and the build applies what's in them:

- `y`: use the proposed label or gloss (in **link to**: use the proposed link)
- any other text: use that instead (in **link to**: a headword, with its homograph number if needed, e.g. `garri2`)
- empty or `n`: leave as it is

Decisions change the website only; the sentence files and the LIFT are not touched. Save the files as
tab-separated text, not .xlsx.

## Lessons (`lessons/` → `docs/lessons/`)

Short lessons made from the sketch grammar: 17 units, 129 lessons, each with a short explanation, examples
and review questions (answers behind "Show answer"). The texts are Markdown, one file per unit, in `lessons/`;
the format is in `lessons/README.md`. After editing them:

    python3 build/build_lessons.py

This writes `docs/lessons/lessons-data.js` and refreshes the `?v=` fingerprints in `docs/lessons/index.html`.
It stops if an example's Kullilli and English lines have different numbers of words, or if a lesson id is
missing or used twice. The page is `/lessons/` on the site (`#/` contents, `#/saved`, `#/<lesson id>`). It
uses the dictionary's `style.css` plus its own `lessons.css`, and links back to the dictionary. The
dictionary's **Lessons** tab is marked "coming soon" while the lessons are being checked: it opens a placeholder
page (`#/lessons`, `viewLessons()` in `app.js`) that doesn't link to the drafts. When they're ready, point the tab
at `lessons/` in `index.html`, remove the badge (`<span class="soon">`) and `viewLessons()`. **Save for later** keeps lesson ids in the browser under `Kullilli.lessons`, so the
backup on My lists includes them. The lesson files aren't in the offline list in `sw.js` yet, so the lessons
need a connection. Notes on what was changed from the grammar, and questions about it:
`KullilliDictionary/review/lessons_review.md`.

## Explore pages (`build/build_explore.py` → `docs/explore/`)

Pages for curiosity rather than learning, at `/explore/` on the site, linked from the About page
("Exploring the dictionary", one link per tab). Three tabs:

- **In numbers** (`#/numbers`): the dictionary counted. It shows entries, recordings, entries with examples,
  example sentences and topics, then:
  - kinds of word;
  - topics, each opening into its smaller topics, with links to the dictionary's topic pages;
  - word length in sounds;
  - how common each sound is, overall and at the start of a word.
- **Sound pairs** (`#/pairs`, `#/pairs/<word>`): minimal pairs, meaning two headwords that differ in one sound.
  Digraphs like `dh`, `ng` and `rr` count as one sound (the alphabet in `settings.json`). Affixes, phrases and
  variants of each other are left out. The page has two views:
  - first, a network of all the pairs, with drag, pinch and ±/Whole network buttons. Choosing a word lists
    its pairs;
  - then a grid of which sounds make the difference: choose a square to list its pairs, with recordings
    (they are picked out in the network too).
  
  The pairs come from the spellings, so g/k, b/p, d/t or r/rr pairs may be spelling differences.
- **Word web** (`#/web/<entry id>`, `#/web/topic/<code>`): choose a word (Kullilli or English) and see the
  related words around it. Choosing a word or topic in the web moves to it, and the list beside the web gives
  every link. The links come in four kinds, each of which can be switched off:
  - **In the dictionary** (blue): the entries' own See also / Used in / Made from / Minimal pair links and
    variants.
  - **Same or opposite meaning** (orange, opposite dashed): the same English gloss, or glosses in one WordNet
    sense; WordNet antonyms.
  - **Kinds and parts** (green): broader/narrower meanings, with the arrow pointing to the broader one. This
    uses the nearest broader WordNet sense that another entry is glossed with, up to 3 steps up (emu → bird).
    Part/whole links are dotted (hand → finger).
  - **Topics** (grey): the entry's topics. A topic's web shows its words, its smaller topics and the topic
    above it.

  WordNet links are made only for nouns, verbs, adjectives and adverbs. They use each gloss's commonest
  senses in the word's own part of speech: two for nouns, adjectives and adverbs, one for verbs (their second
  senses mostly added "a kind of move"). WordNet joins English meanings, so a link can be wrong where an
  English word has several meanings. The page says so.

  The web is sized to the screen: it shows up to 24 words around the centre, fewer on a phone (the list has
  them all).

The figures, pairs and links are worked out by the build, not in the browser. After rebuilding the
dictionary, run:

    python3 build/build_explore.py

What the build does:
- It reads `docs/data/dictionary.js` and WordNet (`../Wordnet_dict`), and writes
  `docs/explore/explore-data.js`.
- It stamps the `?v=` fingerprints in `docs/explore/index.html`.
- It needs `networkx` (and `scipy`) for the network layout. These are the only extra packages the builds use.

How the page works:
- It loads the dictionary's own `data/dictionary.js` and `style.css` (same fingerprints, so they come from
  the browser's saved copy).
- Its own files are `explore.js` and `explore.css`.
- It isn't in the offline list in `sw.js`, so it needs a connection.
- The web's three link colours (`--rel-*` in `explore.css`) were checked for colour-blind readers on the
  paper colour, and the line styles and the list carry the same information.

## Files

| File | What it does |
|---|---|
| `build/build_lift.py` | source material → `docs/data/dictionary.js` + `docs/audio/` |
| `build/sentences.py` | not used since 2026-11-07 (it read the sentences from the Word file) |
| `build/glosscheck.py` | glossing review files, abbreviations, applying review decisions |
| `docs/index.html` | page shell; the About text is in the `<template id="about-tpl">` near the end |
| `docs/style.css` | styles, including the phone layout |
| `docs/search.js` | Kullilli (spelling-tolerant) and English (stemmed, typo-tolerant) search |
| `docs/render.js` | cards, list rows, interlinear examples and entry HTML; part-of-speech labels |
| `docs/games/core.js`, `games.css` | the Learn tab's shared parts and the game registry |
| `docs/sw.js`, `docs/manifest.webmanifest`, `docs/icons/` | offline use and the home-screen app (see Offline use) |
| `docs/games/<name>.js`, `<name>.css` | one game each (see the Learn tab section) |
| `docs/app.js` | wordlist, affixes, search page, entry panel, audio player, URL routing, feedback page |
| `.github/ISSUE_TEMPLATE/*.yml` | the feedback forms (word comment, problem, idea) |
| `lessons/*.md` | the lesson texts, one file per unit (format in `lessons/README.md`) |
| `build/build_lessons.py` | lesson texts → `docs/lessons/lessons-data.js` |
| `docs/lessons/` | the lessons page: `index.html`, `lessons.js` (contents, lessons, save for later), `lessons.css` |
| `build/build_explore.py` | figures, minimal pairs (with network layout) and word links → `docs/explore/explore-data.js` |
| `docs/explore/` | the explore pages: `index.html`, `explore.js` (In numbers, Sound pairs, Word web), `explore.css` |
