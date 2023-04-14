import { ethers } from "ethers";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import mocha from "mocha/mocha.js";

export let wallet: ethers.BrowserProvider | null;
export let blockchain: ethers.BrowserProvider | null;

export async function run(
    myBlockchain: ethers.BrowserProvider,
    myWallet: ethers.BrowserProvider
) {
    wallet = myWallet;
    blockchain = myBlockchain;

    mocha.setup({
        ui: "bdd",
        timeout: 10 * 60 * 1000,
    });
    await import("./tests/getBlockByHash");
    await import("./tests/chainId");
    await import("./tests/blockNumber");
    await import("./tests/getBalance");
    await import("./tests/getTransactionByHash");

    mocha.run();
}
