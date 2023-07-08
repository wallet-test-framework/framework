import * as tests from "../../tests";
import { retry } from "../../util";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("sendTransaction", () => {
    it("sends a transaction correctly", async () => {
        const sender = (await wallet.wallet.getAddresses())[0];

        const balance = 0x100000000000000000000n;
        await blockchain.test.setBalance({ address: sender, value: balance });

        await blockchain.test.mine({ blocks: 1 });

        await retry(async () => {
            const actual = await wallet.public.getBalance({ address: sender });

            assert.equal(actual, balance);
        });

        const value = 1100000000000000000n;
        const responsePromise = wallet.wallet.sendTransaction({
            account: sender,
            to: sender,
            value: value,
        });

        const sendEvent = await wallet.glue.next("sendtransaction");

        assert.equal(
            sendEvent.from.toUpperCase(),
            sender.toUpperCase(),
            `event's from (${sendEvent.from}) matches request (${sender})`
        );
        assert.equal(
            sendEvent.to.toUpperCase(),
            sender.toUpperCase(),
            `event's to (${sendEvent.to}) matches request (${sender})`
        );
        assert.equal(
            BigInt(sendEvent.value),
            value,
            `event's value (${sendEvent.value}) matches request (${value})`
        );

        await wallet.glue.sendTransaction({
            id: sendEvent.id,
            action: "approve",
        });

        const response = await responsePromise;

        await blockchain.test.mine({ blocks: 1 });
        const receipt = await wallet.public.waitForTransactionReceipt({
            hash: response,
        });

        assert.equal(receipt.status, "success");
        assert.equal(receipt.from?.toUpperCase(), sender.toUpperCase());
        assert.equal(receipt.to?.toUpperCase(), sender.toUpperCase());
    });
});
