# Kullilli lessons: the lesson texts

Short lessons made from the *Kullilli Sketch Grammar* (v1, 2023; the PDF is in
`KullilliDictionary/data/`). Each lesson is one idea: a short explanation, a few examples, and
review questions with answers. The lessons page is `docs/lessons/` (on the site: `/lessons/`); it lets
readers save lessons for later (kept in their own browser, under `Kullilli.lessons`, so the
dictionary's backup on the My lists page includes it).

Rebuild after editing:

    cd kullilli && python3 build/build_lessons.py

## Files

One file per unit, numbered so the file names give the order: `01-getting-started.md`,
`02-sounds.md`, … Lessons are numbered automatically (2.3 = unit 2, lesson 3), so lessons and
units can be moved or added without renumbering anything by hand.

## Format

~~~
# Verbs and time                      ← unit title (one per file)

Optional short introduction to the unit.

## Now: -gala                         ← lesson title
id: present-gala                      ← permanent id (used for saved lessons; don't change it)
grammar: Verbs › Present, p. 25       ← where this comes from in the sketch grammar

Explanation. Kullilli words go in braces: {bari-gala} ‘thinking’.
**bold**, *italic*, lists (lines starting "- "), tables (lines starting "|"),
and notes (lines starting "> ") are allowed.

```ex 99/35
gawalyalu  marnnga-gala  bakarranyi
uncle      make-present  boomerang
Uncle is making a boomerang.
```

```words
bari-gala | thinking
```

Q: A review question?
A: Its answer.
~~~

**Examples** (```` ```ex ````): line 1 Kullilli, line 2 the English for each word (same number of
words; join several English words for one Kullilli part with dots: `go.back`), line 3 the
translation. An optional `lit:` line gives a literal translation. After `ex` you can put the
sentence's number in the recorded collection (`146/18`), `made-up` (made up by the guide's
authors, not recorded), and/or `part` (part of a longer sentence).

**Word lists** (```` ```words ````): one `Kullilli | meaning` per line.

The braces and the word-by-word example lines are there so that every Kullilli word can later link
to its dictionary entry.

Spellings and glosses are kept as the sketch grammar has them; questions about them are listed
in `KullilliDictionary/review/lessons_review.md`.
