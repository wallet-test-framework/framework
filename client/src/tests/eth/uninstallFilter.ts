import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("uninstallFilter", () => {
    it("behaves when removing a filter twice", async () => {
        const filter = await wallet.public.createPendingTransactionFilter();

        const first = await wallet.public.uninstallFilter({ filter });
        const second = await wallet.public.uninstallFilter({ filter });

        assert.ok(first, "first uninstall succeeded");
        assert.ok(!second, "second uninstall did not succeed");
    });

    it("behaves when removing a filter that never existed", async () => {
        const result: unknown = await wallet.provider.request({
            method: "eth_uninstallFilter",
            params: ["0xdeadc0de"],
        });
        assert.strictEqual(result, false, "uninstall failed successfully");
    });
});
