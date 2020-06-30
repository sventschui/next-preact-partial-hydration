import { hydrate } from "next-preact-partial-hydration";
import TestHydrated from "../TestHydrated";
import TestStatic from "../TestStatic";
import "preact/devtools";

const isServer = typeof window === "undefined";

export const Foo = hydrate(function _Foo({ bar }) {
  return (
    <div>
      Hello {bar} from {isServer ? "server" : "client"}
    </div>
  );
});

export default function IndexPage() {
  return (
    <div>
      static
      <Foo bar="baz" />
      <TestStatic />
      <TestHydrated />
    </div>
  );
}
