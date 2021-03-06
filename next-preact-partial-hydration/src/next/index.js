// Idea for the webpack plugin:
//  - Replace the client entrypoint with a custom one
//  - use the webpack.DefinePlugin to replace __hydrate_XXX_componentMappings__ with the concrete component mappings

module.exports = function withPartialHydration(nextConfig = {}) {
  return Object.assign({}, nextConfig, {
    webpack(config, options) {
      if (!options.isServer) {
        const oldEntryFn = config.entry;
        config.entry = async function (...args) {
          const oldEntry = await oldEntryFn(...args);

          // oldEntry["static/runtime/main.js"] = [];
          // oldEntry["static/development/pages/_app.js"] = [];

          return oldEntry;
        };
      }

      return typeof nextConfig.webpack === "function"
        ? nextConfig.webpack(config, options)
        : config;
    },
  });
};
