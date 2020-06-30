const { h, Fragment } = require("preact");
const uuid = require("uuid");

function hydrate(Component, options) {
  if (typeof options === "undefined") {
    throw new Error(
      "It seems you are missing the next-preact-partial-hydration babel plugin!"
    );
  }

  // __self contains a circular ref
  return ({ children, __self, ...props }) => {
    const hydrationId = uuid.v4().replace(/-/g, "");

    return h(Fragment, {}, [
      h(
        "script",
        {
          type: "application/hydrate",
          "data-hydration-id": hydrationId,
          dangerouslySetInnerHTML: {
            __html: JSON.stringify({
              ...options,
              props,
            }),
          },
        },
        null
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
