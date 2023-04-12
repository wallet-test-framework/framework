import { blockchain, wallet } from "../../tests";
import assert from "assert";

describe("getBalance", () => {
    it("sending ether to address increases balance", async () => {
        if (!blockchain || !wallet) {
            throw "not ready";
        }

        const src = (await blockchain.listAccounts())[0];
        const dest = (await wallet.listAccounts())[0];

        const balance = "0x100000000000000000000";
        await blockchain.send("evm_setAccountBalance", [src.address, balance]);

        const walletInitalBalance = await wallet.getBalance(dest.address);
        const ganacheInitalBalance = await blockchain.getBalance(dest.address);

        assert.equal(
            walletInitalBalance.toString(),
            ganacheInitalBalance.toString(),
            "initalBalance"
        );

        const value = 1n;
        const response = await src.sendTransaction({
            to: dest,
            value: value,
        });

        await blockchain.send("evm_mine", [{ blocks: 5000 }]);

        const transaction = await wallet.getTransaction(response.hash);
        if (!transaction) {
            throw "no transaction";
        }
        await transaction.wait(10);

        const walletFinalBalance = await wallet.getBalance(dest.address);
        const ganacheFinalBalance = await blockchain.getBalance(dest.address);

        assert.equal(
            walletFinalBalance.toString(),
            ganacheFinalBalance.toString(),
            "finalBalance"
        );

        const expected = value + walletInitalBalance;

        assert.equal(walletFinalBalance, expected);
    });
});
