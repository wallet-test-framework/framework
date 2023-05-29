import * as tests from "../../tests";
import assert from "assert";

const wallet = tests.wallet;
const blockchain = tests.blockchain;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("chainId", () => {
    it("returns the same chain Id", async () => {
        const walletChainId = await wallet.public.getChainId();
        const ganacheChainId = await blockchain.public.getChainId();

        assert.equal(walletChainId, ganacheChainId);
    });
});
