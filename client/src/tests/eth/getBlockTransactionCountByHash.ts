import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getBlockTransactionCountByHash", () => {
    it("returns zero for empty block", async () => {
        const blockNumber = await blockchain.public.getBlockNumber();

        await blockchain.test.mine({ blocks: 1 });

        const blockHash = (
            await blockchain.public.getBlock({ blockNumber: blockNumber + 1n })
        ).hash;
        if (!blockHash) {
            throw "no block hash";
        }

        const count = await wallet.public.getBlockTransactionCount({
            blockHash,
        });

        assert.equal(count, 0);
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
        const mined0 = await blockchain.public.waitForTransactionReceipt({
            hash: response,
        });

        const blockHash0 = (
            await blockchain.public.getBlock({ blockNumber: blockNumber + 1n })
        ).hash;
        if (!blockHash0) {
            throw "no block hash";
        }

        assert.equal(
            mined0?.blockHash,
            blockHash0,
            `first transaction block ${mined0?.blockNumber ?? "<none>"} (${
                mined0?.blockHash ?? "<none>"
            }) matches mined block ${blockNumber + 1n} (${blockHash0})`,
        );

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
        const mined1 = await blockchain.public.waitForTransactionReceipt({
            hash: response,
        });

        const blockHash1 = (
            await blockchain.public.getBlock({ blockNumber: blockNumber + 2n })
        ).hash;
        if (!blockHash1) {
            throw "no block hash";
        }

        assert.equal(
            mined1?.blockHash,
            blockHash1,
            `third transaction block ${mined1?.blockNumber ?? "<none>"} (${
                mined1?.blockHash ?? "<none>"
            })` + ` matches mined block ${blockNumber + 2n} (${blockHash1})`,
        );

        const count0 = await wallet.public.getBlockTransactionCount({
            blockHash: blockHash0,
        });

        assert.equal(count0, 1n);

        const count1 = await wallet.public.getBlockTransactionCount({
            blockHash: blockHash1,
        });

        assert.equal(count1, 2n);
    });

    it("behaves when given a nonexistant block", async () => {
        await assert.rejects(
            wallet.public.getBlockTransactionCount({
                blockHash:
                    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            }),
        );
    });
});
