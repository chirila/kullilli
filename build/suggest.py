"""English suggestions for the search.  Someone searching for an English word that isn't in the dictionary's
English (glosses, definitions, finderlist) is offered related words that are, e.g. infant -> child, dad -> father,
boulder -> rock, stone.  The relations come from WordNet 3.1.  For each of a word's commonest senses (the senses
WordNet has seen in real text, nouns first; for a single word it hasn't seen, its first sense): words in the same
sense (synonyms), then broader and similar words, in that order.  Left out: narrower words (fella -> dog), broader
words for verbs (thump -> move, go), very general words (someone, thing, place), and names of places and people
(Boulder the town).

Reads the WordNet database files (index.* and data.*) from `wordnet_dir`; writes docs/data/suggest.js as
    window.DICT_SUGGEST = {"words": [dictionary English ...], "map": {"infant": [3, 17], ...}}
If WordNet isn't there, the existing file is left as it is."""
import json
import re

POS = {"n": "noun", "v": "verb", "a": "adj", "s": "adj", "r": "adv"}
SENSES = 3            # how many senses of a searched word to use (WordNet lists the commonest first)
MAX = 5               # suggestions per word
WORD = re.compile(r"^[a-z][a-z' -]*$")
# too general to help as a suggestion (they are still searchable)
GENERAL = set("someone something somebody person people thing things one it place part way kind sort be do have get "
              "go make take put set move come give see".split())


def read_wordnet(d):
    """lemma -> [(file pos, offset, tagged)] in sense order;
    (file pos, offset) -> (words, [(symbol, file pos, offset)], is a name)"""
    index, data = {}, {}
    for pos in ("noun", "verb", "adj", "adv"):
        with open(d / f"index.{pos}", encoding="latin-1") as f:
            for line in f:
                if line.startswith(" "):
                    continue
                p = line.split()
                n_syn, n_ptr = int(p[2]), int(p[3])
                tagged = int(p[5 + n_ptr])
                offsets = p[6 + n_ptr:6 + n_ptr + n_syn]
                index.setdefault(p[0], []).extend((pos, o, tagged > i) for i, o in enumerate(offsets))
        with open(d / f"data.{pos}", encoding="latin-1") as f:
            for line in f:
                if line.startswith(" "):
                    continue
                h = line.split("|")[0].split()
                w_cnt = int(h[3], 16)
                raw = [re.sub(r"\(.*\)$", "", h[4 + 2 * i]).replace("_", " ") for i in range(w_cnt)]
                k = 4 + 2 * w_cnt
                ptrs = [(h[k + 1 + 4 * i], POS[h[k + 3 + 4 * i]], h[k + 2 + 4 * i]) for i in range(int(h[k]))]
                name = any(s == "@i" for s, _, _ in ptrs) or all(w[:1].isupper() for w in raw)
                data[(pos, h[0])] = ([w.lower() for w in raw], ptrs, name)
    return index, data


def clean(s):
    s = re.sub(r"\|[a-z]+\{([^}]*)\}", r"\1", s.lower())
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"^\s*to\s+", "", s)
    return re.sub(r"\s+", " ", s).strip(" .!?")


def english(entries):
    """the dictionary's English words and phrases (glosses, finderlist), and every token the search can find"""
    vocab, tokens = {}, set()
    for c in entries:
        for x in [c] + c.get("subs", []):
            texts = [g for s in x.get("senses", []) for g in s.get("gl", [])] + list(x.get("fl", []))
            for t in texts:
                for part in re.split(r"\s*[;,]\s*", t):
                    p = clean(part)
                    if WORD.match(p) and len(p.split()) <= 3 and "?" not in p:
                        vocab[p] = vocab.get(p, 0) + 1
            for t in texts + [d for s in x.get("senses", []) for d in s.get("de", [])]:
                tokens.update(re.findall(r"[a-z']+", clean(t)))
    return vocab, tokens


def write(entries, out, wordnet_dir):
    if not (wordnet_dir / "index.noun").exists():
        return None
    index, data = read_wordnet(wordnet_dir)
    vocab, tokens = english(entries)
    words = sorted((set(vocab) | {t for t in tokens if len(t) > 2}) - GENERAL)   # anything a search will find
    num = {w: i for i, w in enumerate(words)}
    sug = {}
    for lemma, senses in index.items():
        q = lemma.replace("_", " ")
        if not WORD.match(q) or q in vocab or q in tokens or len(q) < 3:
            continue
        common = [(p, o) for p, o, t in senses if t]
        if not common and " " in q:
            continue                                       # rare phrases (tall meadow grass) aren't worth the space
        use = common or [(p, o) for p, o, _ in senses[:1]]                   # nouns first, then verbs …
        use = [s for s in use if not data[s][2]][:SENSES]
        found = []

        def take(ws):
            for w in ws:
                if w in num and w != q and w not in found:
                    found.append(w)

        def related(pos, off, syms):
            for sym, tpos, toff in data[(pos, off)][1]:
                if sym in syms and not data[(tpos, toff)][2]:
                    take(data[(tpos, toff)][0])
        for pos, off in use:
            take(data[(pos, off)][0])                                  # same sense
            related(pos, off, ("@", "&") if pos != "verb" else ("&",))  # broader (not for verbs: move, go …), similar
        if found:
            sug[q] = [num[w] for w in found[:MAX]]
    out.write_text("window.DICT_SUGGEST = " + json.dumps({"words": words, "map": sug}, ensure_ascii=False,
                   separators=(",", ":"), sort_keys=True) + ";\n", encoding="utf-8")
    return len(sug)
