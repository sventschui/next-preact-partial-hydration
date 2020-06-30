const { declare } = require("@babel/helper-plugin-utils");
const uuid = require("uuid");

module.exports = ({ assertVersion, types: t }) => {
  assertVersion(7);

  return {
    visitor: {
      CallExpression(path) {
        // resolve() follows through any intermediary variables
        const callee = path.get("callee").resolve();

        // ignore: foo.bar, function(){}
        if (!t.isIdentifier(callee)) return;
        // the variable name
        const fn = callee.node.name;
        // look up where it was declared:
        const ident = callee.getBindingIdentifierPaths()[fn];
        const binding = ident.scope.getBinding(fn);
        // import x from "source"
        if (binding && binding.kind === "module") {
          const source = binding.path.parent.source.value;

          // is the import for our module?
          if (source === "next-preact-partial-hydration") {
            // TODO: make sure we only process the hydrate function and not other imports
            if (t.isVariableDeclarator(path.parentPath)) {
              // export const foo = hydrate(....)
              if (t.isVariableDeclaration(path.parentPath.parentPath)) {
                if (
                  t.isExportNamedDeclaration(
                    path.parentPath.parentPath.parentPath
                  )
                ) {
                  // append an argument to the call:
                  path.pushContainer(
                    "arguments",
                    t.objectPattern([
                      t.objectProperty(
                        t.stringLiteral("file"),
                        t.stringLiteral(this.file.opts.filename)
                      ),
                      t.objectProperty(
                        t.stringLiteral("specifier"),
                        t.stringLiteral(path.parentPath.node.id.name)
                      ),
                      t.objectProperty(
                        t.stringLiteral("componentKey"),
                        t.stringLiteral(uuid.v4().replace(/-/g, ""))
                      ),
                    ])
                  );
                } else {
                  throw new Error(
                    "Currently we expect the result of hydrate(..) to be assigned to a variable and exported! (3)"
                  );
                }
              } else {
                throw new Error(
                  "Currently we expect the result of hydrate(..) to be assigned to a variable and exported! (2)"
                );
              }
            } /* else if (t.isAssignmentExpression(path.parentPath)) {
              // export default hydrate(...)

              if (t.isExportDefaultDeclaration(path.parentPath.parentPath)) {
                // append an argument to the call:
                path.pushContainer(
                  "arguments",
                  t.objectPattern([
                    t.objectProperty(
                      t.stringLiteral("component"),
                      t.stringLiteral(`${this.file.opts.filename}#$default$`)
                    ),
                  ])
                );
              } else {
                throw new Error(
                  "Currently we expect the result of hydrate(..) to be assigned to a variable and exported! (4)"
                );
              }
            } */ else if (
              t.isExportDefaultDeclaration(path.parentPath)
            ) {
              // export default hydrate(...)

              // append an argument to the call:
              path.pushContainer(
                "arguments",
                t.objectPattern([
                  t.objectProperty(
                    t.stringLiteral("file"),
                    t.stringLiteral(this.file.opts.filename)
                  ),
                  t.objectProperty(
                    t.stringLiteral("specifier"),
                    t.stringLiteral("$default$")
                  ),
                  t.objectProperty(
                    t.stringLiteral("componentKey"),
                    t.stringLiteral(uuid.v4().replace(/-/g, ""))
                  ),
                ])
              );
            } else {
              process.stderr.write("got" + path.parentPath.type + "\n");
              throw new Error(
                "Currently we expect the result of hydrate(..) to be assigned to a variable and exported! (1)"
              );
            }
          }
        }
      },
    },
  };
};
