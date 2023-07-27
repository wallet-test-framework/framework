import * as tests from "../../tests";
import { retry } from "../../util";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("sendRawTransaction", () => {
    it("sends a raw transaction correctly", async () => {
        const sender = (await blockchain.wallet.getAddresses())[0];

        const balance = 0x100000000000000000000n;
        await blockchain.test.setBalance({ address: sender, value: balance });

        await blockchain.test.mine({ blocks: 1 });

        await retry(async () => {
            const actual = await wallet.public.getBalance({ address: sender });

            assert.equal(actual, balance);
        });

        const value = 1100000000000000000n;
        const rawTransaction: unknown = await blockchain.provider.request({
            method: "eth_signTransaction",
            params: [
                {
                    from: sender,
                    to: sender,
                    gas: "0xEA60",
                    gasPrice: "0x77359400",
                    value: "0x" + value.toString(16),
                },
            ],
        });

        const response: unknown = await wallet.provider.request({
            method: "eth_sendRawTransaction",
            params: [rawTransaction],
        });

        if (
            !response ||
            typeof response !== "string" ||
            !response.startsWith("0x")
        ) {
            throw "invalid response";
        }

        await blockchain.test.mine({ blocks: 1 });
        const receipt = await wallet.public.waitForTransactionReceipt({
            hash: response as `0x${string}`,
        });

        assert.equal(receipt.status, "success");
        assert.equal(receipt.from?.toUpperCase(), sender.toUpperCase());
        assert.equal(receipt.to?.toUpperCase(), sender.toUpperCase());
    });
});
