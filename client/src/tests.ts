import { TestChain, WalletChain } from "./index";
import { HtmlTap } from "./reporter";
import mocha from "mocha/mocha.js";

export let wallet: WalletChain | null;
export let blockchain: TestChain | null;

export async function run(myBlockchain: TestChain, myWallet: WalletChain) {
    wallet = myWallet;
    blockchain = myBlockchain;

    mocha.setup({
        ui: "bdd",
        timeout: 10 * 60 * 1000,
        slow: 60100,
        reporter: HtmlTap,
    });
    await import("./tests/eth/accounts");
    await import("./tests/eth/blockNumber");
    await import("./tests/eth/call");
    await import("./tests/eth/chainId");
    await import("./tests/eth/createAccessList");
    await import("./tests/eth/estimateGas");
    await import("./tests/eth/feeHistory");
    await import("./tests/eth/gasPrice");
    await import("./tests/eth/getBalance");
    await import("./tests/eth/getBlockByHash");
    await import("./tests/eth/getBlockByNumber");
    await import("./tests/eth/getBlockTransactionCountByHash");
    await import("./tests/eth/getBlockTransactionCountByNumber");
    await import("./tests/eth/getCode");
    await import("./tests/eth/getFilterChanges");
    await import("./tests/eth/getFilterLogs");
    await import("./tests/eth/getLogs");
    await import("./tests/eth/getProof");
    await import("./tests/eth/getStorageAt");
    await import("./tests/eth/getTransactionByBlockHashAndIndex");
    await import("./tests/eth/getTransactionByBlockNumberAndIndex");
    await import("./tests/eth/getTransactionByHash");
    await import("./tests/eth/getTransactionCount");
    await import("./tests/eth/getTransactionReceipt");
    await import("./tests/eth/maxPriorityFeePerGas");
    await import("./tests/eth/newBlockFilter");
    await import("./tests/eth/newFilter");
    await import("./tests/eth/newPendingTransactionFilter");
    await import("./tests/eth/sendRawTransaction");
    await import("./tests/eth/sendTransaction");
    await import("./tests/eth/sign");
    await import("./tests/eth/signTransaction");
    await import("./tests/eth/uninstallFilter");

    mocha.run();
}
