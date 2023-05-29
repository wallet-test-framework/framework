import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getTransactionCount", () => {
    it("sending transaction from eoa increases nonce", async () => {
        const src = blockchain.wallet.account;
        const dest = wallet.wallet.account;

        const balance = 0x100000000000000000000n;
        await blockchain.test.setBalance({
            address: src.address,
            value: balance,
        });

        const walletInitalNonce = await wallet.public.getTransactionCount({
            address: src.address,
        });
        const ganacheInitalNonce = await blockchain.public.getTransactionCount({
            address: src.address,
        });

        assert.equal(
            walletInitalNonce,
            ganacheInitalNonce,
            "wallet's nonce matches ganache's before sending transaction"
        );

        const response = await blockchain.wallet.sendTransaction({
            to: dest.address,
            value: 0n,
        });

        await blockchain.test.mine({ blocks: 1 });

        await wallet.public.waitForTransactionReceipt({ hash: response });

        const walletFinalNonce = await wallet.public.getTransactionCount({
            address: src.address,
        });
        const ganacheFinalNonce = await blockchain.public.getTransactionCount({
            address: src.address,
        });

        assert.equal(
            walletFinalNonce,
            ganacheFinalNonce,
            "wallet's nonce matches ganache's after sending transaction"
        );

        const expected = 1 + walletInitalNonce;

        assert.equal(walletFinalNonce, expected);
    });
});
