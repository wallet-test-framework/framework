import { blockchain, wallet } from "../../tests";
import assert from "assert";

describe("getBlockTransactionCountByNumber", () => {
    it("returns zero for empty block", async () => {
        if (!blockchain || !wallet) {
            throw "not ready";
        }

        const blockNumber = await blockchain.getBlockNumber();

        await blockchain.send("evm_mine", [{ blocks: 1 }]);

        const count = await wallet.send(
            "eth_getBlockTransactionCountByNumber",
            [blockNumber + 1]
        );
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

        const blockNumber = await blockchain.getBlockNumber();

        await blockchain.send("evm_mine", [{ blocks: 1 }]);
        await response.wait(1);

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
        const mined = await response.wait(1);

        assert.equal(
            mined?.blockNumber,
            blockNumber + 2,
            `transaction block (${mined?.blockNumber}) matches mined block (${
                blockNumber + 2
            })`
        );

        const count0 = await wallet.send(
            "eth_getBlockTransactionCountByNumber",
            [blockNumber + 1]
        );
        if (!count0) {
            throw "no block";
        }

        assert.equal(parseInt(count0, 16), 1);

        const count1 = await wallet.send(
            "eth_getBlockTransactionCountByNumber",
            [blockNumber + 2]
        );
        if (!count1) {
            throw "no block";
        }

        assert.equal(parseInt(count1, 16), 2);
    });
    it("behaves when given a nonexistant block", async () => {
        if (!blockchain || !wallet) {
            throw "not ready";
        }

        const count = await wallet.send(
            "eth_getBlockTransactionCountByNumber",
            [
                "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            ]
        );

        assert.equal(count, null);
    });
});
