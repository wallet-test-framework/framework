import { blockchain, wallet } from "../../tests";
import assert from "assert";

describe("getBlockTransactionCountByHash", () => {
    it("returns zero for empty block", async () => {
        if (!blockchain || !wallet) {
            throw "not ready";
        }

        const blockNumber = Number.parseInt(
            await blockchain.send("eth_blockNumber", []),
            16
        );

        await blockchain.send("evm_mine", [{ blocks: 1 }]);

        const blockHash = (await blockchain.getBlock(blockNumber + 1))?.hash;
        if (!blockHash) {
            throw "no block hash";
        }

        const count = await wallet.send("eth_getBlockTransactionCountByHash", [
            blockHash,
        ]);
        if (!count) {
            throw "no block";
        }

        assert.equal(parseInt(count, 16), 0);
    });

    it("returns the correct count of transactions", async () => {
        if (!blockchain || !wallet) {
            throw "not ready";
        }

        const src = (await blockchain.listAccounts())[0];
        const dest = (await wallet.listAccounts())[0];

        // Create a block with one transaction
        const value = 0n;
        let response = await src.sendTransaction({
            to: dest,
            value: value,
        });

        const blockNumber = Number.parseInt(
            await blockchain.send("eth_blockNumber", []),
            16
        );

        await blockchain.send("evm_mine", [{ blocks: 1 }]);
        const mined0 = await response.wait(1);

        const blockHash0 = (await blockchain.getBlock(blockNumber + 1))?.hash;
        if (!blockHash0) {
            throw "no block hash";
        }

        assert.equal(
            mined0?.blockHash,
            blockHash0,
            `transaction block ${mined0?.blockNumber ?? "<none>"} (${
                mined0?.blockHash ?? "<none>"
            }) matches mined block ${blockNumber + 1} (${blockHash0})`
        );

        // Create a block with two transactions
        await src.sendTransaction({
            to: dest,
            value: value,
        });

        response = await src.sendTransaction({
            to: dest,
            value: value,
        });

        await blockchain.send("evm_mine", [{ blocks: 1 }]);
        const mined1 = await response.wait(1);

        const blockHash1 = (await blockchain.getBlock(blockNumber + 2))?.hash;
        if (!blockHash1) {
            throw "no block hash";
        }

        assert.equal(
            mined1?.blockHash,
            blockHash1,
            `transaction block ${mined1?.blockNumber ?? "<none>"} (${
                mined1?.blockHash ?? "<none>"
            })` + ` matches mined block ${blockNumber + 2} (${blockHash1})`
        );

        const count0 = await wallet.send("eth_getBlockTransactionCountByHash", [
            blockHash0,
        ]);
        if (!count0) {
            throw "no block";
        }

        assert.equal(parseInt(count0, 16), 1);

        const count1 = await wallet.send("eth_getBlockTransactionCountByHash", [
            blockHash1,
        ]);
        if (!count1) {
            throw "no block";
        }

        assert.equal(parseInt(count1, 16), 2);
    });

    it("behaves when given a nonexistant block", async () => {
        if (!blockchain || !wallet) {
            throw "not ready";
        }

        const count = await wallet.send("eth_getBlockTransactionCountByHash", [
            "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ]);

        assert.equal(count, null);
    });
});
