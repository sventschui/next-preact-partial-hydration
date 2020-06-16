import Document, {
  Html,
  Head as NextHead,
  Main,
  NextScript,
} from "next/document";

class Head extends NextHead {
  render() {
    // TODO: use a provider wrapping next's head to override the context
    // instead of monkey-patching it here...
    this.context._documentProps.unstable_runtimeJS = false;
    return super.render();
  }
}

class MyDocument extends Document {
  static getInitialProps(ctx) {
    return Document.getInitialProps(ctx);
  }

  render() {
    return (
      <Html>
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
