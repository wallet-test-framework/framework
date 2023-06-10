import { EMIT_ABI, EMIT_BYTECODE } from "../../contracts/newFilter.sol";
import * as tests from "../../tests";
import assert from "assert";
import * as viem from "viem";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getFilterLogs", () => {
    let contract0: viem.GetContractReturnType<
        typeof EMIT_ABI,
        typeof blockchain.public,
        typeof blockchain.wallet
    >;

    let contract1: viem.GetContractReturnType<
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
                `not deployed: ${receipt0.status} and ${receipt1.status}`
            );
        }

        const address0 = receipt0.contractAddress;
        const address1 = receipt1.contractAddress;

        if (address0 == null || address1 == null) {
            throw "not deployed";
        }

        contract0 = viem.getContract({
            publicClient: blockchain.public,
            walletClient: blockchain.wallet,
            address: address0,
            abi: EMIT_ABI,
        });
        contract1 = viem.getContract({
            publicClient: blockchain.public,
            walletClient: blockchain.wallet,
            address: address1,
            abi: EMIT_ABI,
        });
    });

    it("returns events matching filter", async () => {
        const filter = await wallet.public.createEventFilter({
            address: contract0.address,
        });
        try {
            const call = await contract0.write.logSomething([1234n]);
            await blockchain.test.mine({ blocks: 1 });
            await wallet.public.waitForTransactionReceipt({ hash: call });
            const actual = await wallet.public.getFilterLogs({ filter });
            assert.equal(actual[0].topics[1], 1234n);
        } finally {
            await wallet.public.uninstallFilter({ filter });
        }
    });

    it("doesn't return events from different contract", async () => {
        const filter = await wallet.public.createEventFilter({
            address: contract0.address,
        });
        try {
            const call = await contract1.write.logSomething([1234n]);
            await blockchain.test.mine({ blocks: 1 });
            await wallet.public.waitForTransactionReceipt({ hash: call });
            const actual = await wallet.public.getFilterLogs({ filter });
            assert.equal(actual.length, 0);
        } finally {
            await wallet.public.uninstallFilter({ filter });
        }
    });

    it("doesn't return events outside of block range", async () => {
        const filter = await wallet.public.createEventFilter({
            fromBlock:
                0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffen,
            toBlock:
                0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
        });
        try {
            const call = await contract0.write.logSomething([1234n]);
            await blockchain.test.mine({ blocks: 1 });
            await wallet.public.waitForTransactionReceipt({ hash: call });
            const logs = await wallet.public.getFilterLogs({ filter });
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
            const logs = await wallet.public.getFilterLogs({ filter });
            assert.equal(logs.length, 1);
            assert.equal(logs[0].address, contract0.address);
            assert.equal(logs[0].blockHash, receipt.blockHash);
            assert.equal(logs[0].blockNumber, blockNumber + 1n);
            assert.equal(
                logs[0].topics[1],
                "0x00000000000000000000000000000000000000000000000000000000000004d2"
            );
            assert.equal(logs[0].transactionHash, call);
            assert.equal(logs[0].transactionIndex, receipt.transactionIndex);
        } finally {
            await wallet.public.uninstallFilter({ filter });
        }
    });

    it("behaves when getting logs from new block filter", async () => {
        const filter: unknown = await wallet.provider.request({
            method: "eth_newBlockFilter",
        });
        if (typeof filter !== "string") {
            assert.fail("filter not a string");
        }

        try {
            await assert.rejects(
                wallet.provider.request({
                    method: "eth_getFilterLogs",
                    params: [filter],
                })
            );
        } finally {
            await wallet.provider.request({
                method: "eth_uninstallFilter",
                params: [filter],
            });
        }
    });

    it("behaves when getting logs from new pending transaction filter", async () => {
        const filter: unknown = await wallet.provider.request({
            method: "eth_newPendingTransactionFilter",
        });
        if (typeof filter !== "string") {
            assert.fail("filter not a string");
        }

        try {
            await assert.rejects(
                wallet.provider.request({
                    method: "eth_getFilterLogs",
                    params: [filter],
                })
            );
        } finally {
            await wallet.provider.request({
                method: "eth_uninstallFilter",
                params: [filter],
            });
        }
    });

    it("behaves when getting logs from an uninstalled filter", async () => {
        const filter = await wallet.public.createEventFilter();

        await wallet.public.uninstallFilter({ filter });

        await assert.rejects(wallet.public.getFilterLogs({ filter }));
    });

    it("behaves when getting changes from a filter that never existed", async () => {
        await assert.rejects(
            wallet.provider.request({
                method: "eth_getFilterLogs",
                params: ["0xdeadc0de"],
            })
        );
    });
});
