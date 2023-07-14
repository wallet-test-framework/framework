import * as tests from "../../tests";
import { retry } from "../../util";
import { parseTransaction, serializeTransaction, recoverAddress } from "viem";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("signTransaction", () => {
    it("signs a transaction correctly", async () => {
        const sender = (await wallet.wallet.getAddresses())[0];

        const balance = 0x100000000000000000000n;
        await blockchain.test.setBalance({ address: sender, value: balance });

        await blockchain.test.mine({ blocks: 1 });

        await retry(async () => {
            const actual = await wallet.public.getBalance({ address: sender });

            assert.equal(actual, balance);
        });

        const value = 1100000000000000000n;
        const responsePromise = wallet.provider.request({
            method: "eth_signTransaction",
            params: [{
                account: sender,
                to: sender,
                value: value.toString(),
            }]
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

        const response = await responsePromise;
        //TODO: Don't add 0x prefix
        const fmtTransaction = `0x${response}` as const;
        const transaction = parseTransaction(fmtTransaction);

        assert.equal(transaction.chainId, blockchain.public.chain.id);
        assert.equal(transaction.value, value);
        assert.equal(transaction.to, sender);

        let hash;
        let v = transaction.v;
        const r = transaction.r;
        const s = transaction.s;

        if (v === 27n || v === 28n) {
            v -= 27n;
            hash = "";
        } else {
            const chainId = BigInt(transaction.chainId || 0);
            assert.ok(v == 35n + chainId * 2n || v == 36n + chainId * 2n);
            v = v - 35n - chainId * 2n;
            hash = "";
        }
        const address = await recoverAddress({
                hash:,
                signature:,
            });
    });
});
