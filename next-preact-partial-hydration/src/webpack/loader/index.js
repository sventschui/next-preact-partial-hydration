const { getOptions } = require("loader-utils");
// import validateOptions from 'schema-utils';
//
// const schema = {
//   type: 'object',
//   properties: {
//     test: {
//       type: 'string'
//     }
//   }
// };

module.exports = function (source) {
  const options = getOptions(this);

  const hydrations = JSON.parse(options.hydrations);

  const identifiers = new WeakMap();
  let identifierCounter = 0;

  function componentKey(hydration) {
    return hydration.componentKey;
  }

  function importAs(hydration) {
    if (!identifiers.has(hydration)) {
      identifiers.set(hydration, `Hydration_${identifierCounter++}`);
    }

    return identifiers.get(hydration);
  }

  function importSpecifier(hydration) {
    if (hydration.specifier === "$default$") {
      return importAs(hydration);
    }

    return `{ ${hydration.specifier} as ${importAs(hydration)} }`;
  }

  function importPath(hydration) {
    return hydration.file;
  }

  // validateOptions(schema, options, 'Example Loader');

  // Apply some transformations to the source...

  const code = `
  import { h, hydrate } from 'preact';
  import { useState } from 'preact/hooks';
  
  // START: dynamically generated code
  ${hydrations
    .map(
      (hydration) => `
  import ${importSpecifier(hydration)} from '${importPath(hydration)}';
`
    )
    .join("")}
  
  const componentMappings = {
      ${hydrations.map(
        (hydration) => `"${componentKey(hydration)}": ${importAs(hydration)}`
      )}
  };
  // END: dynamically generated code
  
  Array.from(document.querySelectorAll('script[type="application/hydrate"]')).forEach((startEl) => {
    const hydrationId = startEl.dataset['hydration-id'];
    
    const endEl = document.querySelector(\`script[type="application/hydrate-end"][data-hydration-id="\${hydrationId}"]\`);
    
    const { props, componentKey } = JSON.parse(startEl.innerText);
    const Component = componentMappings[componentKey];
    
    const childNodes = [];
    let currentNode = startEl.nextSibling;
    while (currentNode != null && currentNode !== endEl) {
      childNodes.push(currentNode);
      currentNode = currentNode.nextSibling;
    }
    
    hydrate(h(Component, props, []), {
        childNodes,
        // TODO: In Jason's demo he mentiones this appendChild is not really required, investigate...
        appendChild: function (c) {
          startEl.parentNode.insertBefore(c, endEl);
        },
    });
  });  
`;

  console.log(code);
  return code;
};
