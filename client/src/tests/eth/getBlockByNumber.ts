import * as tests from "../../tests";
import assert from "assert";

const wallet = tests.wallet;
const blockchain = tests.blockchain;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getBlockByNumber", () => {
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

        const walletBlockByNumber = await wallet.public.getBlock({
            blockNumber: blockNumber + 1n,
        });

        assert.equal(walletBlockByNumber.transactions[0], response);
    });

    it("behaves well when the block doesn't exist", async () => {
        const blockNumber =
            0x0000000000000f00000000000000000000000000000000000000000000000000n;

        await assert.rejects(
            wallet.public.getBlock({
                blockNumber,
            })
        );
    });
});
