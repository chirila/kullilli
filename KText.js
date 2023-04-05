
class KText extends HTMLElement {
  constructor() {
    super()
  }

  static get observedAttributes(){
    return ['src']
  }

  async attributeChangedCallback(attribute, oldValue, newValue){
    if(attribute == 'src'){
      console.log(newValue)
      this.fetch(newValue)
    }
  }

  async fetch(url){
    let response = await fetch(url)
    let text = await response.json()
    this.data = text
  }

  set data(text) {
    this.text = text
    this.render()
  }

  get data(){
    return this.text
  }
  
  render() {
    let h2 = document.createElement('h2')
    this.append(h2)
    h2.textContent = this.text.metadata.titles.en

    // the center cannot hold
    document.querySelector('nav')
    let a = document.createElement('a')
    a.textContent = this.data.metadata.titles.en
    let rando = `_${crypto.randomUUID()}`
    a.href = `#${rando}`
    this.id = rando

    let li = document.createElement("li")
    li.append(a)
    document.querySelector('nav').append(li)
  

    this.text.sentences.forEach(sentence => {
      let sentenceDiv = document.createElement('div')
      sentenceDiv.classList.add('sentence')

      let pTranscription = document.createElement('p')
      pTranscription.classList.add('transcription')
      pTranscription.textContent = sentence.transcription
      sentenceDiv.append(pTranscription)

      let wordsDiv = sentence.words.reduce((wordsDiv, word) => {
        let wordDiv = document.createElement('div')
        wordDiv.classList.add('word')

        wordDiv.innerHTML = `
        <span class=orthographic>${word.word_text}</span>
        <span class=word-form>${word.word_breakdown || ""}</span>
        <span class=word-gls>${word.gls || ""}</span>

				<div class="morphemes">
        	${word.morphs.map(morph => {
          let morphemeDiv = document.createElement('div')
          morphemeDiv.classList.add("morpheme")
          morphemeDiv.innerHTML = `
           	<span class=form data-type=form>${morph["morph-txt"] || ""}</span>
           	<span class=cf data-type=cf>${morph["morph-cf"] || ""}</span>
           	<span class=gls data-type=gls>${morph["morph-gls"] || ""}</span>
           	<span class=msa data-type=msa>${morph["morph-msa"] || ""}</span>
           	<span class=pos data-type=pos>${morph["morph_type"] || ""}</span>
           
           `
          return morphemeDiv.outerHTML
        }).join("")
          }
        </div>
        
        `
        wordsDiv.append(wordDiv)
        return wordsDiv
      }, document.createElement('div'))
      wordsDiv.classList.add('words')

      sentenceDiv.append(wordsDiv)

      sentence.translations.forEach(({
        language,
        translation
      }) => {
        let pTranslation = document.createElement('p')
        pTranslation.classList.add("translation")
        pTranslation.textContent = translation
        pTranslation.setAttribute("lang", language)
        sentenceDiv.append(pTranslation)
      })

      this.append(sentenceDiv)
    })
  }
}

customElements.define('k-text', KText)

export {KText}