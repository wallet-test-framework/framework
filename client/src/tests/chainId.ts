import { blockchain, wallet } from "../tests";
import assert from "assert";

describe("chainId", () => {
    it("returns the same chain Id", async () => {
        if (!blockchain || !wallet) {
            throw "not ready";
        }

        const walletChainId = (await wallet.getNetwork()).chainId;
        const ganacheChainId = (await wallet.getNetwork()).chainId;

        assert.equal(walletChainId.toString(), ganacheChainId.toString());
    });
});
