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
components the idea is to keep this simple for the start and wrap all interactive components with a `hydrate` HOC.
These components will then be hydrated on the client.

A webpack and babel plugin combo will then be used to create client bundles that hydrate thede components. This generation of the client bundle will be one of the tricky parts. In a first step we could require the result of the `hydrate` HOC to be exported directly (i.e. `export const foo = hydrate(...)` or `export default hydrate(...)`) but in a later step we might want to export the result of the hydrate call automagically with a babel plugin. This would allow to have non-exported components in a file that are hydrated (i.e. `const Foo = hydrate(...); export default () => (<div><Foo /></div>);`).

## Open points

- Navigation is server side only, this might lead to issues when combining this approach with fully dynamic pages in the same
  next.js project as they navigate client side. Here investigation of the Next.js routing code is required.

# Prior work

- [`next-super-performance`/`pool-attendant-preact`](https://github.com/LukasBombach/next-super-performance) by Lukas Bombach
- [A CSB prototype](https://codesandbox.io/s/preact-htm-selective-hydration-t3d3y?file=/index.html) by Jason Miller

## Example code

### User JavaScript

```js
// src/pages/index.js
import { useState } from 'preact/hooks';
import Header from '../components/header';

// 1. export is required for the generated client bundle, might be auto exported by a babel-plugin in the future.
// 2. we could also provide a decorator (legacy and/or current draft)
export const IndexPageCounter = hydrate(function _IndexPageCounter() {
  const [counter, setCounter] = useState(0);
  return (
    <div>
      {counter}
      <button onClick={() => setCounter(1);} >+1</button>
    </div
  );
});

export default function IndexPage() {
  return (
    <div>
      <Header />
      <p>Some static content</p>
      <IndexPageCounter />
    </div>
  );
}
```

```js
// src/components/header.js
import { useState } from 'preact/hooks';
import SearchResults from 'the-future';

// 1. export is required for the generated client bundle, might be auto exported by a babel-plugin in the future.
// 2. we could also provide a decorator (legacy and/or current draft)
export const HeaderSearch = hydrate(function _HeaderSearch() {
  const [search, setSearch] = useState('');

  return (
    <div>
      <input type="search" value={search} onChange={setSearch} />
      {search && <SearchResults search={search} />
    </div>
  );
});

export default function Header() {

  return (
    <div>
      <nav>
        <a href="/a-static" >A static</a>
        <a href="/navigation" >navigation</a>
      </nav>
      <HeaderSearch />
    </div>
  );
}
```

### Generated code

The `hydrate` HOC and the webpack/babel magic will output HTML and JS in the form below

```html
<div>
  <div>
    <nav>
      <a href="/a-static" >A static</a>
      <a href="/navigation" >navigation</a>
    </nav>
    <script type="application/hydrate" data-hydration-id="0" >{"props":{...},"component":"A"}</script>
    <div>
      <input type="search" value="" />
    </div>
    <script type="application/hydrate-end" data-hydration-id="0" ></script>
    <p>Some static content</p>
    <script type="application/hydrate" data-hydration-id="1" >{"props":{...},"component":"B"}</script>
    <div>
      {counter}
      <button onClick={() => setCounter(1);} >+1</button>
    </div>
    <script type="application/hydrate-end" data-hydration-id="1" ></script>
  </div>
</div>
```

```js
// index.client.js
// Generated by webpack/babel magic
import { hydrate } from "preact";
import { useState } from "preact/hooks";
import SearchResults from "the-future";

// START: dynamically generated code
import { HeaderSearch } from "./components/HeaderSearch";
import { IndexPageCounter } from "./pages/index";

const componentMappings = {
  A: HeaderSearch,
  B: IndexPageCounter,
};
// END: dynamically generated code

Array.from(
  document.querySelectorAll('script[type="application/hydrate"]')
).forEach((startEl) => {
  const hydrationId = startEl.dataset["hydration-id"];

  const endEl = document.querySelector(
    `script[type="application/hydrate-end"][data-hydration-id="${hydrationId}"]`
  );

  const { props, componentKey } = JSON.parse(startEl.innerText);
  const Component = componentMappings[componentKey];

  const childNodes = [];
  let currentNode = startEl.nextSibling;
  while (currentNode != null && currentNode !== endEl) {
    childNodes.push(currentNode);
    currentNode = currentNode.nextSibling;
  }

  hydrate(<Component {...props} />, {
    childNodes,
    // TODO: In Jason's demo he mentiones this appendChild is not really required, investigate...
    appendChild(c) {
      this.parentNode.insertBefore(c, endEl);
    },
  });
});
```

## Previous approaches

### `Hydrate` boundary

A `Hydrate` boundary instead of a `hyderate()` HOC would allow to mix static and dynamic parts in one component. The problem here is that when we want to hydrate two parts of one component we will have to duplicate it's props/state for each hydrated part. This would lead to a very shaky DX and is super hard to implement. Thus this approach is no longer taken into consideration.

#### OUTDATED: User JavaScript

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
        </div>
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
        </div>
      </Hydrate>
    </div>
  );
}
```

#### OUTDATED: Generated code

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
    </div>
    <script type="application/hydrate-end" data-hydration-id="_components_header_0" ></script>
    <p>Some static content</p>
    <script type="application/hydrate" data-hydration-id="_pages_index_0" >{"props":{...}}</script>
    <div>
      {counter}
      <button onClick={() => setCounter(1);} >+1</button>
    </div>
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
