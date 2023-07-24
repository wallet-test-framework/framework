import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("gasPrice", () => {
    it("returns the same gas price as the client", async () => {
        await blockchain.test.mine({ blocks: 2 });

        const fromWallet = await wallet.public.getGasPrice();
        const fromGanache = await blockchain.public.getGasPrice();

        assert.equal(fromWallet, fromGanache);
    });
});
