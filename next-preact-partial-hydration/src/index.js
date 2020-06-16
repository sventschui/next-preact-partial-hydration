const { h, Fragment } = require("preact");

function hydrate(Component, options) {
  if (typeof options === "undefined") {
    throw new Error(
      "It seems you are missing the next-preact-partial-hydration babel plugin!"
    );
  }

  console.log(options);

  // __self contains a circular ref
  return ({ children, __self, ...props }) => {
    const hydrationId = "TOOD";

    return h(Fragment, {}, [
      h(
        "script",
        {
          type: "application/hydrate",
          "data-hydration-id": hydrationId,
        },
        JSON.stringify({
          component: "TODO",
          props,
        })
      ),
      h(Component, props, children),
      h(
        "script",
        {
          type: "application/hydrate-end",
          "data-hydration-id": hydrationId,
        },
        null
      ),
    ]);
  };
}

module.exports = {
  hydrate,
};
