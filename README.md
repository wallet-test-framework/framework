# Wallet Test Framework

[blog](https://wtf.allwallet.dev/)

## Friends of Wallet Test Framework

We would like to extend our heartfelt thanks to the sponsors making this project possible:

<a title="Brave" href="https://brave.com/"><img
        height="64"
        alt="Brave Logo"
        src="https://wtf.allwallet.dev/sponsors/brave.svg"></a>
<a title="Ethereum Foundation" href="https://esp.ethereum.foundation/"><img
        height="64"
        alt="Ethereum Logo"
        src="https://wtf.allwallet.dev/sponsors/ef.svg"></a>

## Usage

Optionally, you can [configure npm to install without superuser permissions][unglobal].

```bash
# Install the server
npm install -g @wallet-test-framework/framework

# Run the server
wtfd
```

[unglobal]: https://github.com/sindresorhus/guides/blob/3f4ad3e30efd384f42384b61b38e82626a4c3b7a/npm-global-without-sudo.md

## Development

### Building

To install the dependencies:

```bash
npm install --include=dev
```

To compile the TypeScript into JavaScript and create the relevant bundles:

```bash
npm run build
```

### Linting

Before creating a pull request, please make sure to run:

```bash
npm test
```

### Running

After building, you can run the web server with:

```bash
node dist/server/index.js
```
