import { Chain, TestChain } from "./index";
import mocha from "mocha/mocha.js";

export let wallet: Chain | null;
export let blockchain: TestChain | null;

export async function run(myBlockchain: TestChain, myWallet: Chain) {
    wallet = myWallet;
    blockchain = myBlockchain;

    mocha.setup({
        ui: "bdd",
        timeout: 10 * 60 * 1000,
        slow: 60100,
    });
    await import("./tests/eth/getBlockByHash");
    await import("./tests/eth/getBlockByNumber");
    await import("./tests/eth/getBlockTransactionCountByHash");
    await import("./tests/eth/getBlockTransactionCountByNumber");
    await import("./tests/eth/chainId");
    await import("./tests/eth/blockNumber");
    await import("./tests/eth/newFilter");
    await import("./tests/eth/newBlockFilter");
    await import("./tests/eth/getBalance");
    await import("./tests/eth/getStorageAt");
    await import("./tests/eth/getTransactionCount");
    await import("./tests/eth/getCode");
    await import("./tests/eth/getTransactionByHash");
    await import("./tests/eth/getTransactionByBlockHashAndIndex");
    await import("./tests/eth/getTransactionByBlockNumberAndIndex");
    await import("./tests/eth/getTransactionReceipt");

    mocha.run();
}
