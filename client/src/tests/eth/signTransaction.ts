import * as tests from "../../tests";
import { delay, notEver } from "../../util";
import { retry } from "../../util";
import assert from "assert";
import { parseTransaction } from "viem";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("signTransaction", () => {
    it("signs a transaction correctly", async () => {
        const filter = await blockchain.public.createPendingTransactionFilter();

        try {
            const sender = (await wallet.wallet.getAddresses())[0];

            const balance = 0x100000000000000000000n;
            await blockchain.test.setBalance({
                address: sender,
                value: balance,
            });

            await blockchain.test.mine({ blocks: 1 });

            await retry(async () => {
                const actual = await wallet.public.getBalance({
                    address: sender,
                });

                assert.equal(actual, balance);
            });

            const value = 1100000000000000000n;
            const responsePromise = wallet.provider.request({
                method: "eth_signTransaction",
                params: [
                    {
                        from: sender,
                        to: sender,
                        value: "0x" + value.toString(16),
                    },
                ],
            });

            const signEvent = await wallet.glue.next("signtransaction");

            assert.equal(
                signEvent.from.toUpperCase(),
                sender.toUpperCase(),
                `event's from (${signEvent.from}) matches request (${sender})`
            );
            assert.equal(
                signEvent.to.toUpperCase(),
                sender.toUpperCase(),
                `event's to (${signEvent.to}) matches request (${sender})`
            );
            assert.equal(
                BigInt(signEvent.value),
                value,
                `event's value (${signEvent.value}) matches request (${value})`
            );

            await wallet.glue.signTransaction({
                id: signEvent.id,
                action: "approve",
            });

            const response: unknown = await responsePromise;
            if (typeof response !== "string" || !response.startsWith("0x")) {
                throw "expected hex string";
            }

            // Make sure the signed transaction doesn't appear on-chain.
            await notEver(
                (async () => {
                    let changes = [];
                    while (changes.length == 0) {
                        await delay(100);
                        changes = await blockchain.public.getFilterChanges({
                            filter,
                        });
                    }
                })()
            );

            const transaction = parseTransaction(response as `0x${string}`);

            assert.equal(transaction.chainId, blockchain.public.chain.id);
            assert.equal(transaction.value, value);
            assert.equal(transaction.to?.toUpperCase(), sender.toUpperCase());

            const rawHash: unknown = await blockchain.provider.request({
                method: "eth_sendRawTransaction",
                params: [response],
            });

            if (typeof rawHash !== "string" || !rawHash.startsWith("0x")) {
                throw "expected hex string";
            }

            await blockchain.test.mine({ blocks: 1 });

            const receipt = await blockchain.public.waitForTransactionReceipt({
                hash: rawHash as `0x${string}`,
            });

            assert.equal(receipt.status, "success");
        } finally {
            await blockchain.public.uninstallFilter({ filter });
        }
    });
});
