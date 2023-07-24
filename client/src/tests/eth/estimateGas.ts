import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("estimateGas", () => {
    it("estimates the amount of gas used for a transaction", async () => {
        const src = (await blockchain.wallet.getAddresses())[0];
        const dest = (await wallet.wallet.getAddresses())[0];

        const fromWallet = await wallet.public.estimateGas({
            account: src,
            to: dest,
            value: 0n,
        });

        const fromGanache = await blockchain.public.estimateGas({
            account: src,
            to: dest,
            value: 0n,
        });

        assert.equal(fromWallet, fromGanache);
    });
});
