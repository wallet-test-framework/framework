import { blockchain, wallet } from "../tests";
import assert from "assert";

describe("blockNumber", () => {
    it("block number from wallet and ganache are the same", async () => {
        if (!blockchain || !wallet) {
            throw "not ready";
        }

        const walletInitalBlockNumber = await wallet.getBlockNumber();
        const ganacheInitalBlockNumber = await blockchain.getBlockNumber();

        assert.equal(
            walletInitalBlockNumber.toString(),
            ganacheInitalBlockNumber.toString(),
            "initalBlockNumber"
        );

        await blockchain.send("evm_mine", [{ blocks: 5000 }]);

        const walletFinalBlockNumber = await wallet.getBlockNumber();
        const ganacheFinalBlockNumber = await blockchain.getBlockNumber();

        assert.equal(
            walletFinalBlockNumber.toString(),
            ganacheFinalBlockNumber.toString(),
            "finalBlockNumber"
        );

        const expected = walletInitalBlockNumber + 5000;

        assert.equal(walletFinalBlockNumber, expected);
    });
});
