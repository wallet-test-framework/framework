import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("maxPriorityFeePerGas", () => {
    it("returns the same max priority fee as the client", async () => {
        await blockchain.test.mine({ blocks: 2 });

        const fromWallet: unknown = await wallet.provider.request({
            method: "eth_maxPriorityFeePerGas",
        });
        const fromGanache: unknown = await blockchain.provider.request({
            method: "eth_maxPriorityFeePerGas",
        });

        assert.deepEqual(fromWallet, fromGanache);
    });
});
