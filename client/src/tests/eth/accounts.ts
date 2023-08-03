import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("accounts", () => {
    it("returns a list of accounts", async () => {
        const accounts = await wallet.wallet.getAddresses();

        for (const account of accounts) {
            assert.ok(account.startsWith("0x"), "account is a hex string");
        }
    });
});
