import { hydrate } from "next-preact-partial-hydration";

const isServer = typeof window === "undefined";

export default hydrate(function TestHydrated() {
  return <div>I'm rendered on {isServer ? "server" : "client"}</div>;
});
