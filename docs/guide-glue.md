---
weight: 4
---

# Writing Glue

See [Development](./development.md) for setup instructions.

In WTF, glue is software that connects the tests to individual wallets. This layer of abstraction allows the test to be agnostic to the details of how each wallet works.

## Choosing Automation Framework

The first step in writing glue is choosing the automation framework you would like to use. This choice is primarily dictated by the platform and UI library your wallet uses. Currently all WTF glues use [selenium-webdriver](https://www.npmjs.com/package/selenium-webdriver), though other options could include [Appium](https://www.npmjs.com/package/appium) or [Dogtail](https://gitlab.com/dogtail/dogtail).

If your wallet runs in a browser, Selenium WebDriver is the likely candidate.

## First steps

!!! note "Are you using selenium-webdriver and glue-ws?"

    If your wallet is close enough to one of our existing glues (like [glue-taho](https://github.com/wallet-test-framework/glue-taho) or [glue-coinbase](https://github.com/wallet-test-framework/glue-coinbase)), it will be easier to start by cloning that glue instead of starting from scratch.

Once you have chosen your automation framework, the next step is to subclass [`Glue`](https://github.com/wallet-test-framework/glue/blob/f9bf7497562d1da616320c1f1d133a61e94bc4fd/src/index.ts#L7). WTF provides a default implementation using WebSockets: [glue-ws](https://github.com/wallet-test-framework/glue-ws). If glue-ws is acceptable (it probably is), you can setup a project using the following:

```bash
mkdir glue-mywallet
cd glue-mywallet
npm init
# customize the project to your needs
npm i @wallet-test-framework/glue-ws
```

In `index.ts`:

```typescript
import serveGlue, { ServeResult } from "@wallet-test-framework/glue-ws";
import * as process from "node:process";

// MyWalletGlue should be your subclass of Glue.
const implementation = new MyWalletGlue();

// serveGlue spawns a websocket server to handle requests from tests.
const serveResult = serveGlue(implementation, { port: 0 });

// testUrl is the location of the WTF frontend dapp.
const testUrl = "https://wallet-test-framework.herokuapp.com/";

async function start(testUrl, implementation, serveResult) {
  // This function should prepare everything your glue needs to automate
  // a wallet. For example, for a browser-based wallet, this function would
  // launch a browser, install the wallet extension, navigate to testUrl, and
  // click the connect button.
}

try {
  // Perform setup and launch the tests.
  await start(testUrl, implementation, serveResult);

  // Collect the test results.
  const report = await implementation.reportReady;

  if (typeof report.value !== "string") {
    throw new Error("unsupported report type");
  }

  process.stdout.write(report.value);
} finally {
  await serveResult.close();
}
```

## Subclassing `Glue`

Regardless whether you're using [glue-ws](https://github.com/wallet-test-framework/glue-ws) or not, eventually you will need to subclass `Glue`. There are several key methods that need to be overridden (for example: `activateChain`, `sendTransaction`, and `addEthereumChain`), and several key events that need to be emitted (for example: `requestaccounts`).

### Responding to Dialogs

These methods are invoked by tests to respond to dialogs opened by the wallet (see [`index.ts`](https://github.com/wallet-test-framework/glue/blob/master/src/index.ts) for an exhaustive list), and beside each is the most common JSON-RPC endpoint that causes the dialog.

- `requestAccounts` (`eth_requestAccounts`)
- `signMessage` (`eth_sign`)
- `sendTransaction` (`eth_sendTransaction`)
- `signTransaction` (`eth_signTransaction`)
- `switchEthereumChain` (`wallet_switchEthereumChain`)
- `addEthereumChain` (`wallet_addEthereumChain`)

The implementations of theses methods should interact with the wallet UI. In the case of browser extension wallets, for example, these methods use selenium-webdriver to fill in text boxes and click buttons. They shouldn't call into private wallet APIs because then it wouldn't be true end-to-end testing.

### Utility Methods

There are two non-dialog related methods:

- `activateChain` requests that the wallet add a new EVM compatible chain with a given chainID and RPC URL.
- `report` passes the completed test report (in xunit format) to the glue for display/processing.

### Events

Events are how the glue reports back to the tests. Events usually represent dialogs. The following is a list of events, and the most common JSON-RPC endpoint that triggers them.

- `requestaccounts` (`eth_requestAccounts`)
- `signmessage` (`eth_sign`)
- `sendtransaction` (`eth_sendTransaction`)
- `signtranasction` (`eth_signTransaction`)
- `addethereumchain` (`wallet_addEthereumChain`)
- `switchethereumchain` (`wallet_switchEthereumChain`)
