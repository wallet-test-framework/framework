import { blockchain, wallet } from "../../tests";
import assert from "assert";

describe("getTransctionByHash", () => {
    it("returns the same transaction as sent", async () => {
        if (!blockchain || !wallet) {
            throw "not ready";
        }

        const src = (await blockchain.listAccounts())[0];
        const dest = (await wallet.listAccounts())[0];

        const value = 0n;
        const response = await src.sendTransaction({
            to: dest,
            value: value,
        });

        await blockchain.send("evm_mine", [{ blocks: 5000 }]);
        await response.wait(10);

        const walletTransactionByHash = await wallet.getTransaction(
            response.hash
        );
        if (!walletTransactionByHash) {
            throw "no transaction";
        }

        assert.equal(walletTransactionByHash.from, src.address);

        assert.equal(walletTransactionByHash.to, dest.address);

        assert.equal(walletTransactionByHash.value, value);
    });
});
