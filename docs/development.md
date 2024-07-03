---
weight: 2
---

# Development

## Prerequisites

- NodeJS >= 18.14.2
- A browser that [supports ES2020](https://caniuse.com/sr_es11) (like Brave or Firefox).
- An Ethereum wallet that supports custom RPC endpoints (see our [most recent test report](https://wtf.allwallet.dev/categories/test-report/) for options).
- Git

## Preparing your Environment

### Getting the Code

Quickest way to get started is by cloning the [WTF](https://github.com/wallet-test-framework/framework) repository:

```bash
git clone git@github.com:wallet-test-framework/framework.git
```

### Installing Dependencies

The project uses `npm` as a package manager. You can install the required modules by running:

```bash
npm install --include=dev
```

## Running

To build and run the project, run:

```bash
npm run build && npm start
```

Then open your browser to <http://localhost:3000/>. See [The Manual Glue & You](./guide-manual.md) for detailed instructions on how to use the manual glue.
