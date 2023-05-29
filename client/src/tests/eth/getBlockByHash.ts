import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getBlockByHash", () => {
    it("returns the mined block", async () => {
        const dest = wallet.wallet.account;

        const value = 0n;
        const response = await blockchain.wallet.sendTransaction({
            to: dest.address,
            value: value,
        });

        const blockNumber = await blockchain.public.getBlockNumber();

        await blockchain.test.mine({ blocks: 1 });
        await blockchain.public.waitForTransactionReceipt({ hash: response });

        const blockHash = (
            await blockchain.public.getBlock({ blockNumber: blockNumber + 1n })
        ).hash;
        if (!blockHash) {
            throw "no block hash";
        }

        const walletBlockByHash = await wallet.public.getBlock({ blockHash });

        assert.equal(walletBlockByHash.transactions[0], response);
    });

    it("behaves well when the block doesn't exist", async () => {
        const blockHash =
            "0x0000000000000000000000000000000000000000000000000000000000000000";

        await assert.rejects(wallet.public.getBlock({ blockHash }));
    });
});
