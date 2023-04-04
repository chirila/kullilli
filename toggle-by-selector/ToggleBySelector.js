class ToggleBySelector extends HTMLElement {
  constructor(){
    super()
    this.innerHTML = `<ul></ul>`
    this.listen()
  }

  async fetch(url){
    let response = await fetch(url)
    let data = await response.json()
    this.data = data
  }

  connectedCallback(){

  }

  static get observedAttributes(){
    return ["selectors"]
  }

  attributeChangedCallback(attribute, oldValue, newValue){
    if(attribute == "selectors"){
      this.data = newValue.split(/\p{White_Space}+/gu)
    }
  }

  set data(selectors){
    this.selectors = selectors
    
    this.render()
  }

  get data(){
    return this.selectors
  }


  render(){
    this.selectors.map(selector => {
      let li = document.createElement('li')
      li.innerHTML = `<label>
        <input type=checkbox name="${selector}" checked> ${selector}
      </label>`
      return li
    })
    .forEach(li => this.querySelector('ul').append(li))
  }

  listen(){
    this.addEventListener('change', changeEvent => {
      if(changeEvent.target.matches('input[type="checkbox"]')){
        let checkbox = changeEvent.target

        let selector = checkbox.name

        document.querySelectorAll(selector)
          .forEach(el => {
              el.style.display = checkbox.checked? 'block' : 'none'
            
          })
      }
    })
  }
}

export {ToggleBySelector}
customElements.define('toggle-by-selector', ToggleBySelector)
