---
lang: en
title:  \<toggle-by-selector\>
css: toggle-by-selector.css
---

<div>

# \<toggle-by-selector\>

</div>

<main>
::: {#example .section}
## Example


```html
<div>
  <p class=red>red</p>
<p class=blue>blue</p>
</div>
```


<article style=display:grid;grid-template-columns:repeat(2,1fr)>

<div>
<p class=red>red</p>
<p class=blue>blue</p>
</div>


<toggle-by-selector selectors=".red .blue">
</toggle-by-selector>

</article>




```html
<toggle-by-selector selectors=".red .blue">
</toggle-by-selector>
```

:::

::: {#attributes .section}
## Attributes
:::

::: {#methods .section}
## Methods
:::

::: {#data .section}
## Data
:::

::: {#events .section}
## Events
:::

::: {#layouts .section}
## Layouts
:::

::: {#see-also .section}
## See also
:::
</main>


<script type="module">
import {ToggleBySelector} from './ToggleBySelector.js'

window.toggleBySelector = document.querySelector('toggle-by-selector')
</script>

