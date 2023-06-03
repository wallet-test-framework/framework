import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getTransactionByBlockHashAndIndex", () => {
    it("returns the mined transactions", async () => {
        const response = await blockchain.wallet.sendTransaction({
            to: "0x0000000000000000000000000000000000000000",
            value: 0n,
        });

        await blockchain.test.mine({ blocks: 1 });

        const receipt = await wallet.public.waitForTransactionReceipt({
            hash: response,
        });

        const tx: unknown = await wallet.provider.request({
            method: "eth_getTransactionByBlockHashAndIndex",
            params: [receipt.blockHash, 0],
        });
        if (!tx || typeof tx !== "object" || !("hash" in tx)) {
            assert.fail("Could not decode transaction");
        }

        assert.equal(tx.hash, response);
    });

    it("behaves when requesting non-existent block", async () => {
        const tx: unknown = await wallet.provider.request({
            method: "eth_getTransactionByBlockHashAndIndex",
            params: [
                "0x0000000000000000000000000000000000000000000000000000000000000000",
                0,
            ],
        });

        assert.strictEqual(tx, null);
    });
});
