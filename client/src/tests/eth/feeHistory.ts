import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("feeHistory", () => {
    it("returns the same fee history as the client", async () => {
        await blockchain.test.mine({ blocks: 2 });

        const fromWallet = await wallet.public.getFeeHistory({
            blockCount: 2,
            rewardPercentiles: [25, 75],
        });

        const fromGanache = await blockchain.public.getFeeHistory({
            blockCount: 2,
            rewardPercentiles: [25, 75],
        });

        assert.deepEqual(fromWallet, fromGanache);
        assert.equal(2, fromWallet.reward?.length);
    });
});
