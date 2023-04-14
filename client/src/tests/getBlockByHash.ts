// Make a block with a transaction. Get the has of that block. Ask the wallet for the block by hash. Make sure the transaction is in that block
import { blockchain, wallet } from "../tests";
import assert from "assert";

describe("getBlockByHash", () => {
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

        const blockHash = (await blockchain.getBlock(blockNumber + 1))?.hash;
        if (!blockHash) {
            throw "no block hash";
        }

        const walletBlockByHash = await wallet.getBlock(blockHash);
        if (!walletBlockByHash) {
            throw "no block";
        }

        assert.equal(walletBlockByHash.transactions[0], response.hash);
    });
});
