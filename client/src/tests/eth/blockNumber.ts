import * as tests from "../../tests";
import { retry } from "../../util";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("blockNumber", () => {
    it("block number from wallet and ganache are the same", async () => {
        const walletInitalBlockNumber = Number.parseInt(
            await wallet.send("eth_blockNumber", []),
            16
        );
        const ganacheInitalBlockNumber = Number.parseInt(
            await blockchain.send("eth_blockNumber", []),
            16
        );

        assert.equal(
            walletInitalBlockNumber.toString(),
            ganacheInitalBlockNumber.toString(),
            "initalBlockNumber"
        );

        await blockchain.send("evm_mine", [{ blocks: 5000 }]);

        const ganacheFinalBlockNumber = Number.parseInt(
            await blockchain.send("eth_blockNumber", []),
            16
        );

        const expected = walletInitalBlockNumber + 5000;
        assert.equal(ganacheFinalBlockNumber, expected);

        await retry(async () => {
            const walletFinalBlockNumber = Number.parseInt(
                await wallet.send("eth_blockNumber", []),
                16
            );

            assert.equal(
                walletFinalBlockNumber.toString(),
                ganacheFinalBlockNumber.toString(),
                `wallet's final block number (${walletFinalBlockNumber}) equals` +
                    ` blockchain's final block number (${ganacheFinalBlockNumber})`
            );
        });
    });
});
