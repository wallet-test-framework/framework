import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("newPendingTransactionFilter", () => {
    it("returns pending transactions", async () => {
        const filter = await wallet.public.createPendingTransactionFilter();

        try {
            const tx = await blockchain.wallet.sendTransaction({});

            const changes = await wallet.public.getFilterChanges({ filter });

            assert.deepEqual(changes, [tx]);
        } finally {
            await blockchain.test.mine({ blocks: 1 });

            await wallet.public.uninstallFilter({ filter });
        }
    });
});
