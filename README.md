# next-preact-partial-hydration

> **WIP** This repo does not yet include any code, it is a concept only at this stage!

## The problem

When we build mostly static, server-side-rendered websites with (p)react 
"the amount of JavaScript work being performed during page load is 
routinely multiple orders of magnitude more than what would be considered efficient." (Jason Miller).

The Gatsby project embraced this problem and offers the [`gatys-plugin-no-javascript`]() as a solution. 
"This is useful if your site is truly a static site with no interactivity or maybe the interactivity
is handled by different javascript than your React components." (Gatsby). In most cases modern websites are
not fully static, think about your fancy slider you have on your start page, an autocomplete, etc. So we
are set back to handle interactivity by "different javascript". We could use jQuery, or even introduce
a custom built (p)react bundle to add interactivity.

Having to maintain a different codebase for the client reminds me of the good old PHP+jQuery days.
Nothing wrong with this but I love the idea of having a single source that runs on the server
and on the client. So how can we only ship the JavaScript required for the interactive parts of
our website to the client while maintaining the developer experience of todays SSR?

## The idea

To ship the minimal amount of JavaScript to the client we need to identify interactive parts on our website. While
this might be done through a fancy babel plugin with complex heuristics that determine the interactivity of certain
components the idea is to keep this simple for the start and wrap all interactive parts within `<Hydrate>` component
(a hydration boundary).
The children of this component will then be hydrated on the client.

A webpack and babel plugin combo will then be used to identify and extract the code required for the hydration. The code
required to hydrate all interactive parts of a page is then put into a client bundle for this page (<- this is the tricky part).

## Open points

- Navigation is server side only, this might lead to issues when combining this approach with fully dynamic pages in the same
  next.js project as they navigate client side.
- How to handle state of class components or hooks that is used below multiple hydration boundaries? Duplicating the state
  will lead to unexpected behaviour.
  - `useState` could be replaced with that fancy new global state manager whose name I just forgot
  - We could introduce compiler errors/eslint rules to forbid this. But to what extend would we allow the use of state?
  - We could entirely forbid the use of state in the wrapping component/do not re-hydrate it on the client. This way
    state/interactivity must reside in the components wrapped with `<Hydrate>`
- Would it make things simpler when using a `withHydration` HOC instead of the `<Hydrate>` boundary?

# Prior work

- [`next-super-performance`/`pool-attendant-preact`](https://github.com/LukasBombach/next-super-performance) by Lukas Bombach
- [A CSB prototype](https://codesandbox.io/s/preact-htm-selective-hydration-t3d3y?file=/index.html) by Jason Miller

## Example code

### User JavaScript

The only thing a user of partial hydration needs to take care of is to wrap
any interactive JSX in a `<Hydrate>` node.

```js
// src/pages/index.js
import { useState } from 'preact/hooks';
import Header from '../components/header';

export default function IndexPage() {
  const [counter, setCounter] = useState(0);
  return (
    <div>
      <Header />
      <p>Some static content</p>
      <Hydrate>
        <div>
          {counter}
          <button onClick={() => setCounter(1);} >+1</button>
        </div
      </Hydrate>
    </div>
  );
}
```

```js
// src/components/header.js
import { useState } from 'preact/hooks';
import SearchResults from 'the-future';

export default function Header() {
  const [search, setSearch] = useState('');
  
  return (
    <div>
      <nav>
        <a href="/a-static" >A static</a>
        <a href="/navigation" >navigation</a>
      </nav>
      <Hydrate>
        <div>
          <input type="search" value={search} onChange={setSearch} />
          {search && <SearchResults search={search} />
        </div
      </Hydrate>
    </div>
  );
}
```

### Generated code

The `Hydrate` component and the webpack/babel magic will generate HTML and JS in the form below

```html
<div>
  <div>
    <nav>
      <a href="/a-static" >A static</a>
      <a href="/navigation" >navigation</a>
    </nav>
    <script type="application/hydrate" data-hydration-id="_components_header_0" >{"props":{...}}</script>
    <div>
      <input type="search" value="" />
    </div
    <script type="application/hydrate-end" data-hydration-id="_components_header_0" ></script>
    <p>Some static content</p>
    <script type="application/hydrate" data-hydration-id="_pages_index_0" >{"props":{...}}</script>
    <div>
      {counter}
      <button onClick={() => setCounter(1);} >+1</button>
    </div
    <script type="application/hydrate-end" data-hydration-id="_pages_index_0" ></script>
  </div>
  </div>
```

```js
// index.client.js
// Generated by webpack/babel magic
import { hydrate } from 'preact';
import { useState } from 'preact/hooks';
import SearchResults from 'the-future';

function Pages_Index_0() {
  const [counter, setCounter] = useState(0);
  return (
    <div>
      {counter}
      <button onClick={() => setCounter(1);} >+1</button>
    </div
  );
}

function Components_Header_0() {
  const [search, setSearch] = useState('');
  
  return (
    <div>
      <input type="search" value={search} onChange={setSearch} />
      {search && <SearchResults search={search} />
    </div
  );
}

// TODO: read props for the top-level trees from the hydration scripts
hydrate(<Pages_Index_0 />, createHydrationRoot('_pages_index_0'));
hydrate(<Components_Header_0 />, createHydrationRoot('_components_header_0'));
```
