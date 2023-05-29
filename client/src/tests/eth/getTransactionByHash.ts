import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getTransctionByHash", () => {
    it("returns the same transaction as sent", async () => {
        const dest = wallet.wallet.account.address;

        const value = 0n;
        const response = await blockchain.wallet.sendTransaction({
            to: dest,
            value: value,
        });

        await blockchain.test.mine({ blocks: 5000 });
        await blockchain.public.waitForTransactionReceipt({ hash: response });

        const walletTransactionByHash = await wallet.public.getTransaction({
            hash: response,
        });

        assert.equal(
            walletTransactionByHash.from,
            blockchain.wallet.account.address
        );

        assert.equal(walletTransactionByHash.to, dest);

        assert.equal(walletTransactionByHash.value, value);
    });
});
