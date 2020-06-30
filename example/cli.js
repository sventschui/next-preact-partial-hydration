#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
require("./alias")();

const workerJs = require.resolve("next/dist/export/worker.js");
const aliasJs = path.resolve("./alias.js");
const aliasPath = path.relative(path.dirname(workerJs), aliasJs);
const requireStatement = `require("${aliasPath}")();`;

const content = fs.readFileSync(workerJs, "utf8");

if (content.indexOf(requireStatement) === -1) {
  fs.writeFileSync(workerJs, requireStatement + content);
}

require("next/dist/bin/next");
