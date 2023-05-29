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
        const walletInitalBlockNumber = await wallet.public.getBlockNumber();
        const ganacheInitalBlockNumber =
            await blockchain.public.getBlockNumber();

        assert.equal(
            walletInitalBlockNumber,
            ganacheInitalBlockNumber,
            "initalBlockNumber"
        );

        await blockchain.test.mine({ blocks: 5000 });

        const ganacheFinalBlockNumber =
            await blockchain.public.getBlockNumber();

        const expected = walletInitalBlockNumber + 5000n;
        assert.equal(
            ganacheFinalBlockNumber,
            expected,
            `blockchain's final block number (${ganacheFinalBlockNumber}) equals` +
                ` wallet's initial block number plus number mined (${expected})`
        );

        await retry(async () => {
            const walletFinalBlockNumber = await wallet.public.getBlockNumber();

            assert.equal(
                walletFinalBlockNumber,
                ganacheFinalBlockNumber,
                `wallet's final block number (${walletFinalBlockNumber}) equals` +
                    ` blockchain's final block number (${ganacheFinalBlockNumber})`
            );
        });
    });
});
