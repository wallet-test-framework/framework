import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getBlockTransactionCountByNumber", () => {
    it("returns zero for empty block", async () => {
        const blockNumber = await blockchain.public.getBlockNumber();

        await blockchain.test.mine({ blocks: 1 });

        const count = await wallet.public.getBlockTransactionCount({
            blockNumber: blockNumber + 1n,
        });

        assert.equal(count, 0n);
    });
    it("returns the correct count of transactions", async () => {
        const dest = wallet.wallet.account.address;

        // Create a block with one transaction
        const value = 0n;
        let response = await blockchain.wallet.sendTransaction({
            to: dest,
            value: value,
        });

        const blockNumber = await blockchain.public.getBlockNumber();

        await blockchain.test.mine({ blocks: 1 });
        await blockchain.public.waitForTransactionReceipt({ hash: response });

        // Create a block with two transactions
        await blockchain.wallet.sendTransaction({
            to: dest,
            value: value,
        });

        response = await blockchain.wallet.sendTransaction({
            to: dest,
            value: value,
        });

        await blockchain.test.mine({ blocks: 1 });
        const mined = await blockchain.public.waitForTransactionReceipt({
            hash: response,
        });

        assert.equal(
            mined?.blockNumber,
            blockNumber + 2n,
            `transaction block (${
                mined?.blockNumber ?? "<none>"
            }) matches mined block (${blockNumber + 2n})`
        );

        const count0 = await wallet.public.getBlockTransactionCount({
            blockNumber: blockNumber + 1n,
        });

        assert.equal(count0, 1n);

        const count1 = await wallet.public.getBlockTransactionCount({
            blockNumber: blockNumber + 2n,
        });

        assert.equal(count1, 2n);
    });
    it("behaves when given a nonexistent block", async () => {
        await assert.rejects(
            wallet.public.getBlockTransactionCount({
                blockNumber:
                    0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
            })
        );
    });
});
