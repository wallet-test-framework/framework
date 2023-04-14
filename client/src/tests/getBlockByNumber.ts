import { blockchain, wallet } from "../tests";
import assert from "assert";

describe("getBlockByNumber", () => {
    it("returns the mined block", async () => {
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

        const blockNumber = await blockchain.getBlockNumber();

        await blockchain.send("evm_mine", [{ blocks: 1 }]);
        await response.wait(1);

        const walletBlockByNumber = await wallet.getBlock(blockNumber + 1);
        if (!walletBlockByNumber) {
            throw "no block";
        }

        assert.equal(walletBlockByNumber.transactions[0], response.hash);
    });

    it("behaves well when the block doesn't exist", async () => {
        if (!blockchain || !wallet) {
            throw "not ready";
        }

        const blockNumber =
            "0x0000000000000f00000000000000000000000000000000000000000000000000";

        const walletBlockByNumber = await wallet.getBlock(blockNumber);

        assert.equal(walletBlockByNumber, null);
    });
});
