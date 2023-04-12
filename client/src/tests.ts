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
    await import("./tests/eth/getBlockByHash");
    await import("./tests/eth/getBlockByNumber");
    await import("./tests/eth/getBlockTransactionCountByHash");
    await import("./tests/eth/getBlockTransactionCountByNumber");
    await import("./tests/eth/chainId");
    await import("./tests/eth/blockNumber");
    await import("./tests/eth/getBalance");
    await import("./tests/eth/getTransactionByHash");

    mocha.run();
}
