import { EMIT_ABI, EMIT_BYTECODE } from "../../contracts/newFilter.sol";
import * as tests from "../../tests";
import { retry } from "../../util";
import assert from "assert";
import * as viem from "viem";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("sendTransaction", () => {
    let contractAddress: `0x${string}`;
    let contract: viem.GetContractReturnType<
        typeof EMIT_ABI,
        typeof wallet.public,
        typeof wallet.wallet
    >;

    before(async () => {
        const contractHash = await blockchain.wallet.deployContract({
            abi: EMIT_ABI,
            bytecode: EMIT_BYTECODE,
        });

        await blockchain.test.mine({ blocks: 1 });

        const address = (
            await blockchain.public.waitForTransactionReceipt({
                hash: contractHash,
            })
        ).contractAddress;
        if (address == null) {
            throw "not deployed";
        }
        contractAddress = address;
        contract = viem.getContract({
            publicClient: wallet.public,
            walletClient: wallet.wallet,
            address,
            abi: EMIT_ABI,
        });
    });

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

    it("sends a transaction to a contract", async () => {
        const sender = (await wallet.wallet.getAddresses())[0];

        const balance = 0x100000000000000000000n;
        await blockchain.test.setBalance({ address: sender, value: balance });

        await blockchain.test.mine({ blocks: 1 });

        await retry(async () => {
            const actual = await wallet.public.getBalance({ address: sender });

            assert.equal(actual, balance);
        });

        const callPromise = contract.write.logSomething([1234n]);
        const sendEvent = await wallet.glue.next("sendtransaction");

        assert.ok(
            viem.isAddressEqual(viem.getAddress(sendEvent.from), sender),
            `event's from (${sendEvent.from}) matches request (${sender})`
        );

        assert.ok(
            viem.isAddressEqual(viem.getAddress(sendEvent.to), contractAddress),
            `event's to (${sendEvent.to}) matches request (${contractAddress})`
        );

        assert.equal(
            sendEvent.data.toLowerCase(),
            "0xa2bed3f200000000000000000000000000000000000000000000000000000000000004d2",
            `event's data matches request`
        );

        await wallet.glue.sendTransaction({
            id: sendEvent.id,
            action: "approve",
        });

        const response = await callPromise;

        await blockchain.test.mine({ blocks: 1 });
        const receipt = await wallet.public.waitForTransactionReceipt({
            hash: response,
        });

        assert.equal(receipt.status, "success");
        assert.equal(receipt.from?.toUpperCase(), sender.toUpperCase());
        assert.equal(receipt.to?.toUpperCase(), contractAddress.toUpperCase());
    });
});
