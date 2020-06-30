// Idea for the webpack plugin:
//  - Replace the client entrypoint with a custom one
//  - use the webpack.DefinePlugin to replace __hydrate_XXX_componentMappings__ with the concrete component mappings

const NAME = "NextPreactPartialHydrationWebpackPlugin";
const fs = require("fs");
const webpack = require("webpack");
const path = require("path");
const SingleEntryDependency = require("webpack/lib/dependencies/SingleEntryDependency");

module.exports = class NextPreactPartialHydrationWebpackPlugin {
  apply(compiler) {
    const hydrateCallsByModule = {};
    const entriesToAdd = [];

    compiler.hooks.afterCompile.tapAsync(NAME, (compilation, callback) => {
      let remainingInvocations = entriesToAdd.length;

      if (entriesToAdd.length == 0) {
        callback();
      }

      entriesToAdd.forEach(({ request, context, hydrations }) => {
        console.log("adding entry for original request", request, "...");
        // TODO: We seem to be to late to add an Entry. The compilation is already
        // sealed at this point and the entry is not handled.
        // Adding it during the compilation.hooks.succeedEntry hook seems to soon as it throws:
        //     TypeError: Cannot read property 'addChunk' of null
        //       at Object.connectChunkAndModule (/Users/sventschui/code/github.com/sventschui/next-preact-partial-hydration/node_modules/webpack/lib/GraphHelpers.js:35:13)
        //       at Compilation.seal (/Users/sventschui/code/github.com/sventschui/next-preact-partial-hydration/node_modules/webpack/lib/Compilation.js:1308:17)
        //       at /Users/sventschui/code/github.com/sventschui/next-preact-partial-hydration/node_modules/webpack/lib/Compiler.js:675:18
        //       at /Users/sventschui/code/github.com/sventschui/next-preact-partial-hydration/node_modules/webpack/lib/Compilation.js:1261:4
        compilation.addEntry(
          context,
          new SingleEntryDependency(
            `${require.resolve(
              "next-preact-partial-hydration/webpack-loader"
            )}?hydrations=${encodeURIComponent(JSON.stringify(hydrations))}!`
          ),
          "foo-bar", // TODO: derive something from the original `request`
          (err, mod) => {
            console.log("done", err, mod, remainingInvocations);
            if (err) {
              console.log("addEntry failed!!! ", err);
              remainingInvocations = -1;
              callback(err);
            } else {
              if (--remainingInvocations == 0) {
                callback();
              }
            }
          }
        );
      });
    });

    compiler.hooks.compilation.tap(
      NAME,
      (compilation, { normalModuleFactory }) => {
        compilation.dependencyFactories.set(
          SingleEntryDependency,
          normalModuleFactory
        );

        compilation.hooks.childCompiler.tap(NAME, (entry, callback) => {
          console.log("childCompiler!!!!");
        });
        compilation.hooks.succeedEntry.tap(NAME, (entry, callback) => {
          console.log("succeedEntry"); // , entry, entry.module.dependencies);

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

          collectHydrations(entry.module);

          const { request, userRequest } = entry;

          // TODO: This works for SingleModuleEntry only....
          const context = entry.module && entry.module.context;

          console.log({ request, userRequest, context });

          if (hydrations.length === 0) {
            console.log("No hydrations for entry");
            return;
          }

          console.log("=> ", hydrations);

          entriesToAdd.push({
            request,
            context,
            hydrations,
          });
        });

        compilation.hooks.finishModules.tap(NAME, (...args) => {
          // console.log("finish modules", ...args);
          const dir = path.join(process.cwd(), ".next/partial-hydration");
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, "test.js"), "123", "utf8");
          // compilation.addEntry(__dirname, path.join(dir, "test.js"), "test");
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
              if (!hydrateCallsByModule[parser.state.module]) {
                hydrateCallsByModule[parser.state.module] = [];
              }

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
