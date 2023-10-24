import { EMIT_ABI, EMIT_BYTECODE } from "../../contracts/newFilter.sol";
import * as tests from "../../tests";
import assert from "assert";
import * as viem from "viem";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getLogs", () => {
    let contractAddress0: `0x${string}`;
    let contractAddress1: `0x${string}`;
    let contract0: viem.GetContractReturnType<
        typeof EMIT_ABI,
        typeof blockchain.public,
        typeof blockchain.wallet
    >;

    before(async () => {
        const contractHash0 = await blockchain.wallet.deployContract({
            abi: EMIT_ABI,
            bytecode: EMIT_BYTECODE,
            gas: 150000n,
        });
        const contractHash1 = await blockchain.wallet.deployContract({
            abi: EMIT_ABI,
            bytecode: EMIT_BYTECODE,
            gas: 150000n,
        });

        await blockchain.test.mine({ blocks: 1 });

        const receipt0 = await blockchain.public.waitForTransactionReceipt({
            hash: contractHash0,
        });
        const receipt1 = await blockchain.public.waitForTransactionReceipt({
            hash: contractHash1,
        });
        if (receipt0.status !== "success" || receipt1.status !== "success") {
            throw new Error(
                `not deployed: ${receipt0.status} and ${receipt1.status}`,
            );
        }

        const address0 = receipt0.contractAddress;
        const address1 = receipt1.contractAddress;

        if (address0 == null || address1 == null) {
            throw "not deployed";
        }

        contractAddress0 = address0;
        contractAddress1 = address1;

        contract0 = viem.getContract({
            publicClient: blockchain.public,
            walletClient: blockchain.wallet,
            address: address0,
            abi: EMIT_ABI,
        });
    });

    it("doesn't return events outside of block range", async () => {
        const call = await contract0.write.logSomething([1234n]);
        await blockchain.test.mine({ blocks: 1 });
        await wallet.public.waitForTransactionReceipt({ hash: call });
        const logs = await wallet.public.getLogs({
            fromBlock: 0x01ffffffffffffen,
            toBlock: 0x01fffffffffffffn,
        });
        assert.equal(logs.length, 0);
    });

    it("doesn't return events for a different contract", async () => {
        const blockNumber = await blockchain.public.getBlockNumber();
        const call = await contract0.write.logSomething([1234n]);
        await blockchain.test.mine({ blocks: 1 });
        await wallet.public.waitForTransactionReceipt({ hash: call });
        const logs = await wallet.public.getLogs({
            fromBlock: blockNumber + 1n,
            toBlock: blockNumber + 1n,
            address: contractAddress1,
        });
        assert.equal(logs.length, 0);
    });

    it("returns events from a recent block", async () => {
        const blockNumber = await blockchain.public.getBlockNumber();
        const call = await contract0.write.logSomething([1234n]);
        await blockchain.test.mine({ blocks: 1 });
        const receipt = await wallet.public.waitForTransactionReceipt({
            hash: call,
        });
        const logs = await wallet.public.getLogs({
            fromBlock: blockNumber + 1n,
            toBlock: blockNumber + 1n,
            address: contractAddress0,
        });
        assert.equal(logs.length, 1);
        assert.equal(logs[0].address, contract0.address);
        assert.equal(logs[0].blockHash, receipt.blockHash);
        assert.equal(logs[0].blockNumber, blockNumber + 1n);
        assert.equal(
            logs[0].topics[1],
            "0x00000000000000000000000000000000000000000000000000000000000004d2",
        );
        assert.equal(logs[0].transactionHash, call);
        assert.equal(logs[0].transactionIndex, receipt.transactionIndex);
    });
});
