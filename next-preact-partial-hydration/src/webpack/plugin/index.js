// Idea for the webpack plugin:
//  - Replace the client entrypoint with a custom one
//  - use the webpack.DefinePlugin to replace __hydrate_XXX_componentMappings__ with the concrete component mappings

const NAME = "NextPreactPartialHydrationWebpackPlugin";
const fs = require("fs");
const webpack = require("webpack");
const path = require("path");
const SingleEntryDependency = require("webpack/lib/dependencies/SingleEntryDependency");
const MultiEntryDependency = require("webpack/lib/dependencies/MultiEntryDependency");
const MultiModuleFactory = require("webpack/lib/MultiModuleFactory");
const DynamicEntryPlugin = require("webpack/lib/DynamicEntryPlugin");

module.exports = class NextPreactPartialHydrationWebpackPlugin {
  apply(compiler) {
    const hydrateCallsByModule = {};

    compiler.hooks.compilation.tap(
      NAME,
      (compilation, { normalModuleFactory }) => {
        const multiModuleFactory = new MultiModuleFactory();

        compilation.dependencyFactories.set(
          MultiEntryDependency,
          multiModuleFactory
        );
        compilation.dependencyFactories.set(
          SingleEntryDependency,
          normalModuleFactory
        );
      }
    );

    compiler.hooks.compilation.tap(
      NAME,
      (compilation, { normalModuleFactory }) => {
        compilation.dependencyFactories.set(
          SingleEntryDependency,
          normalModuleFactory
        );

        compilation.hooks.finishModules.tapAsync(NAME, (modules, callback) => {
          Promise.all(
            compilation.entries.map(async (entry) => {
              if (
                entry.request &&
                entry.request.indexOf(
                  "next-preact-partial-hydration/webpack-loader"
                ) !== -1
              ) {
                return;
              }

              // collect all calls to hydrate() for this entry
              let hydrations = [];
              const visited = new WeakSet();

              function collectHydrations(mod) {
                if (mod == null || visited.has(mod)) {
                  return;
                }

                visited.add(mod);

                if (hydrateCallsByModule[mod]) {
                  hydrations = hydrations.concat(hydrateCallsByModule[mod]);
                }

                if (Array.isArray(mod.dependencies)) {
                  for (const dependency of mod.dependencies) {
                    if (dependency.module) {
                      collectHydrations(dependency.module);
                    }
                  }
                }
              }

              collectHydrations(entry);

              if (hydrations.length === 0) {
                return;
              }

              const addEntry = (entry, name) => {
                const dep = DynamicEntryPlugin.createDependency(entry, name);

                return new Promise((res, rej) => {
                  compilation.addEntry(this.context, dep, name, (err) => {
                    if (err) {
                      rej(err);
                    } else {
                      res();
                    }
                  });
                });
              };

              const existingEntry = compilation._preparedEntrypoints.find(
                (prepEntry) => prepEntry.module === entry
              );

              await addEntry(
                `next-preact-partial-hydration/webpack-loader?hydrations=${encodeURIComponent(
                  JSON.stringify(hydrations)
                )}!`,
                existingEntry.name
              );
            })
          ).then(
            () => callback(),
            (err) => callback(err)
          );
        });
      }
    );

    compiler.hooks.normalModuleFactory.tap(NAME, (factory) => {
      factory.hooks.parser
        .for("javascript/auto")
        .tap(NAME, (parser) => parse(parser, false));
      factory.hooks.parser
        .for("javascript/dynamic")
        .tap(NAME, (parser) => parse(parser, false));
      factory.hooks.parser
        .for("javascript/esm")
        .tap(NAME, (parser) => parse(parser, true));

      const parse = (parser, esModule) => {
        const identifiers = new WeakSet();

        // collect all identifiers reffering to the `hydrate` export of `next-preact-partial-hydration`
        parser.hooks.import.tap(NAME, (i) => {
          if (i.source.value === "next-preact-partial-hydration") {
            const specifier = i.specifiers.find(
              (s) => s.imported.name === "hydrate"
            );

            if (specifier) {
              identifiers.add(specifier.local);
            }
          }
        });

        // collect all calls to the `hydrate` function and keep track of them in `hydrateCallsByModule`
        parser.hooks.evaluate
          .for("CallExpression")
          .tap(NAME, function (expression) {
            // TODO: do not detect by name but rather by imports we collected in `identifiers`
            if (expression.callee.name === "hydrate") {
              if (expression.arguments.length !== 2) {
                throw new Error(
                  "Expected hydrate() call to get exactly 2 arguments!"
                );
              }

              if (expression.arguments[1].type !== "ObjectExpression") {
                throw new Error(
                  "Expected hydrate() call to get an object expression as second argument!"
                );
              }

              // TODO: can we collect file and specifier info form webpack AST instead of requiring
              // the babel plugin? babel plugin would still be required to add a UUID to each component
              const fileProp = expression.arguments[1].properties.find(
                (prop) =>
                  prop.type === "Property" &&
                  prop.key.type === "Literal" &&
                  prop.key.value === "file" &&
                  prop.value.type === "Literal"
              );

              if (!fileProp) {
                throw new Error(
                  "Expected hydrate() call to get an object expression with a 'file' property as second argument!"
                );
              }

              const specifierProp = expression.arguments[1].properties.find(
                (prop) =>
                  prop.type === "Property" &&
                  prop.key.type === "Literal" &&
                  prop.key.value === "specifier" &&
                  prop.value.type === "Literal"
              );

              if (!specifierProp) {
                throw new Error(
                  "Expected hydrate() call to get an object expression with a 'specifier' property as second argument!"
                );
              }

              const componentKeyProp = expression.arguments[1].properties.find(
                (prop) =>
                  prop.type === "Property" &&
                  prop.key.type === "Literal" &&
                  prop.key.value === "componentKey" &&
                  prop.value.type === "Literal"
              );

              if (!componentKeyProp) {
                throw new Error(
                  "Expected hydrate() call to get an object expression with a 'componentKey' property as second argument!"
                );
              }

              if (!hydrateCallsByModule[parser.state.module]) {
                hydrateCallsByModule[parser.state.module] = [];
              }

              hydrateCallsByModule[parser.state.module].push({
                file: fileProp.value.value,
                specifier: specifierProp.value.value,
                componentKey: componentKeyProp.value.value,
              });
            }
          });
      };
    });
  }
};
