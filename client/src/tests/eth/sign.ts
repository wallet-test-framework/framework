import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("sign", () => {
    it("returns a correctly signed message", async () => {
        const signaturePromise = wallet.wallet.signMessage({ message: "text" });
        const signatureEvent = await wallet.glue.next("signmessage");
        assert.equal(signatureEvent.message, "text");

        await wallet.glue.signMessage({
            id: signatureEvent.id,
            action: "approve",
        });

        const signature = await signaturePromise;
        const valid = await blockchain.public.verifyMessage({
            address: wallet.wallet.account.address,
            message: "text",
            signature,
        });

        assert.ok(
            valid,
            `valid signature from ${wallet.wallet.account.address}`
        );
    });
});
