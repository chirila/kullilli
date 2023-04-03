/*
    Flex doesn’t delimit gloss morphs, so we infer delimiters from the
    morph_type attribute’s value
*/
let flexMorphToDoclingGlossMorpheme = morph => {
  let glossMorpheme = morph.getAttribute('morph-gls')

  let isPrefix = morph.getAttribute('morph_type') == 'prefix'
  let isSuffix = morph.getAttribute('morph_type') == 'suffix'

  return (isSuffix? '-' : "") + glossMorpheme + (isPrefix ? '-' : "")
}

/* 
    docling views expect a unitary gloss property with a string value
*/
let flexWordToDoclingGloss = word => word
  .morphs
  .map(flexMorphToDoclingGlossMorpheme)
  .join("")

/*
    docling views expect words to have a unitary form property
    with a string value
*/
let flexWordToDoclingForm = word => word
  .morphs
  .map(morph => morph.getAttribute('morph-txt'))
  .join("")

/*
    Haven’t been storing explicit morphemes in docling.js text 
    objects (very verbose), but since there’s so much info here
    we will.
*/

let flexMorphemeToMorpheme = flexMorpheme => {
  let items = Array.from(flexMorpheme.querySelectorAll('item[type]'))
  let morpheme = items.reduce((morpheme, item) => {
    let lang = item.getAttribute('lang')
    let key = item.getAttribute('type')

    let langKey = `${lang}_${key}`
    let value = item.textContent.trim()
    morpheme[langKey] = value
    return morpheme
  }, {})
  
  let type = flexMorpheme.getAttribute('type')
  morpheme.type = type
  
  return morpheme
}

let flexWordToMorphemes = word => {
  let flexMorphemes = Array.from(word.querySelector('morphemes'))

  let morphemes = flexMorphemes
    .map(flexMorpheme => flexMorphemeToMorpheme(flexMorpheme))
  
  return morphemes
}

let  flexWordToDoclingPhrasal = word => {
  let wordLevelPhrasalGloss // may or may not exist

  let wordLevelPhrasalGlossItem = Array.from(word.children)
    .filter(child => child.localName == 'item')
    .find(child => child.getAttribute("type") == 'gls')

  if(wordLevelPhrasalGlossItem){
    wordLevelPhrasalGloss = wordLevelPhrasalGlossItem.textContent
  }
  
  return wordLevelPhrasalGloss || ""
}

let  flexWordToDoclingGrammar = word => {
  let grammar = {}
  let pos = word.querySelector('item[type="pos"]')
  if(pos){
    grammar.pos = pos.textContent
  }
  return grammar
}

let  flexWordToNotes = word => {
  let noteItems = Array.from(word.querySelectorAll('item[type="note"]'))

  let notes = []
  if(noteItems){
     notes.push(
        ...noteItems.map(noteItem => ({
          note: noteItem.textContent,
          lang: noteItem.getAttribute("lang")
        })
      )
    )
  }
  return notes
}

let flexWordToDoclingWord = word => ({
  form: flexWordToDoclingForm(word),
  gloss: flexWordToDoclingGloss(word),
  phrasal: flexWordToDoclingPhrasal(word),
  morphemes: flexMorphemesToMorphemes(word),
  grammar: {
    pos: flexWordToDoclingGrammar
  },
  metadata: {
    notes: flexWordToNotes(word) 
  }
})
