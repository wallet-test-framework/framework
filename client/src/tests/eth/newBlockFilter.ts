import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("newBlockFilter", () => {
    it("returns newly mined blocks", async () => {
        const filter = await wallet.public.createBlockFilter();

        const blockNumber = await blockchain.public.getBlockNumber();
        await blockchain.test.mine({ blocks: 1 });
        const blockHash = (
            await blockchain.public.getBlock({ blockNumber: blockNumber + 1n })
        ).hash;

        const hashes = await wallet.public.getFilterChanges({ filter });

        await wallet.public.uninstallFilter({filter});
        assert.deepEqual(hashes, [blockHash]);
    });
});
