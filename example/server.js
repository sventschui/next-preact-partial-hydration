// server.js
require("./alias")();
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
require("preact/compat");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });

app.prepare().then(() => {
  createServer((req, res) => {
    // Be sure to pass `true` as the second argument to `url.parse`.
    // This tells it to parse the query portion of the URL.
    const parsedUrl = parse(req.url, true);
    const { pathname, query } = parsedUrl;

    app.render(req, res, pathname, query);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log("> Ready on http://localhost:3000");
  });
});
