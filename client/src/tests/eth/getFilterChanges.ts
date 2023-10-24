import { EMIT_ABI, EMIT_BYTECODE } from "../../contracts/newFilter.sol";
import * as tests from "../../tests";
import assert from "assert";
import * as viem from "viem";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getFilterChanges", () => {
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

        await blockchain.test.mine({ blocks: 1 });

        const receipt0 = await blockchain.public.waitForTransactionReceipt({
            hash: contractHash0,
        });
        if (receipt0.status !== "success") {
            throw new Error(`not deployed: ${receipt0.status}`);
        }

        const address0 = receipt0.contractAddress;

        if (address0 == null) {
            throw "not deployed";
        }

        contract0 = viem.getContract({
            publicClient: blockchain.public,
            walletClient: blockchain.wallet,
            address: address0,
            abi: EMIT_ABI,
        });
    });

    it("behaves when getting changes from an uninstalled filter", async () => {
        const filter = await wallet.public.createPendingTransactionFilter();

        await wallet.public.uninstallFilter({ filter });

        await assert.rejects(wallet.public.getFilterChanges({ filter }));
    });

    it("behaves when getting changes from a filter that never existed", async () => {
        await assert.rejects(
            wallet.provider.request({
                method: "eth_getFilterChanges",
                params: ["0xdeadc0de"],
            }),
        );
    });

    it("doesn't return events outside of block range", async () => {
        const filter = await wallet.public.createEventFilter({
            fromBlock: 0x01ffffffffffffen,
            toBlock: 0x01fffffffffffffn,
        });
        try {
            const call = await contract0.write.logSomething([1234n]);
            await blockchain.test.mine({ blocks: 1 });
            await wallet.public.waitForTransactionReceipt({ hash: call });
            const logs = await wallet.public.getFilterChanges({ filter });
            assert.equal(logs.length, 0);
        } finally {
            await wallet.public.uninstallFilter({ filter });
        }
    });

    it("returns events inside the block range", async () => {
        const blockNumber = await wallet.public.getBlockNumber();
        const filter = await wallet.public.createEventFilter({
            fromBlock: blockNumber + 1n,
            toBlock: blockNumber + 2n,
        });
        try {
            const call = await contract0.write.logSomething([1234n]);
            await blockchain.test.mine({ blocks: 1 });
            const receipt = await wallet.public.waitForTransactionReceipt({
                hash: call,
            });
            const logs = await wallet.public.getFilterChanges({ filter });
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
        } finally {
            await wallet.public.uninstallFilter({ filter });
        }
    });
});
