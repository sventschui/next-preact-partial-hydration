import { hydrate } from "next-preact-partial-hydration";

const isServer = typeof window === "undefined";

export const Foo = hydrate(function _Foo({ bar }) {
  return (
    <div>
      Hello {bar} from {isServer ? "server" : "client"}
    </div>
  );
});

export default function TestPage() {
  return (
    <div>
      static
      <Foo bar="baz" />
    </div>
  );
}
