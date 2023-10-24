import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getTransactionReceipt", () => {
    it("returns receipt matching transaction", async () => {
        const response = await blockchain.wallet.sendTransaction({
            to: "0x0000000000000000001000000000000000000000",
            value: 16n,
        });

        const blockNumber = 1n + (await blockchain.public.getBlockNumber());

        await blockchain.test.mine({ blocks: 1 });

        const block = await blockchain.public.getBlock({ blockNumber });

        const receipt = await wallet.public.waitForTransactionReceipt({
            hash: response,
        });

        assert.equal(receipt.blockHash, block.hash);
        assert.equal(receipt.blockNumber, block.number);
        assert.equal(receipt.contractAddress, null);
        assert.equal(receipt.cumulativeGasUsed, block.gasUsed);
        assert.equal(receipt.from, blockchain.wallet.account.address);
        assert.equal(receipt.gasUsed, block.gasUsed);
        assert.equal(receipt.logs.length, 0);
        assert.equal(receipt.status, "success");
        assert.equal(receipt.to, "0x0000000000000000001000000000000000000000");
        assert.equal(receipt.transactionHash, response);
        assert.equal(receipt.transactionIndex, 0);
    });

    it("behaves when fetching non-existent transaction", async () => {
        await assert.rejects(
            wallet.public.getTransactionReceipt({
                hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            }),
        );
    });
});
