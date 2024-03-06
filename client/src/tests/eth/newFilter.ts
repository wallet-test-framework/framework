import { EMIT_ABI, EMIT_BYTECODE } from "../../contracts/newFilter.sol";
import * as tests from "../../tests";
import { notEver } from "../../util";
import assert from "assert";
import * as viem from "viem";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("newFilter", () => {
    let contract0: viem.GetContractReturnType<
        typeof EMIT_ABI,
        {
            public: typeof blockchain.public;
            wallet: typeof blockchain.wallet;
        }
    >;

    let contract1: viem.GetContractReturnType<
        typeof EMIT_ABI,
        {
            public: typeof blockchain.public;
            wallet: typeof blockchain.wallet;
        }
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

        contract0 = viem.getContract({
            client: {
                public: blockchain.public,
                wallet: blockchain.wallet,
            },
            address: address0,
            abi: EMIT_ABI,
        });
        contract1 = viem.getContract({
            client: {
                public: blockchain.public,
                wallet: blockchain.wallet,
            },
            address: address1,
            abi: EMIT_ABI,
        });
    });

    it("returns events matching filter", async () => {
        const eventPromise = new Promise<viem.Log[]>((resolve) => {
            const unwatch = contract0.watchEvent.Log(
                {},
                {
                    pollingInterval: 100,
                    onLogs: (a) => {
                        unwatch();
                        resolve(a);
                    },
                },
            );
        });
        const call = await contract0.write.logSomething([1234n]);
        await blockchain.test.mine({ blocks: 1 });
        await wallet.public.waitForTransactionReceipt({ hash: call });
        const actual = await eventPromise;
        assert.equal(actual[0].topics[1], 1234n);
    });

    it("doesn't return events from different contract", async () => {
        const eventPromise = new Promise((resolve) => {
            const unwatch = contract1.watchEvent.Log(
                {},
                {
                    pollingInterval: 100,
                    onLogs: (a) => {
                        unwatch();
                        resolve(a);
                    },
                },
            );
        });
        const call = await contract0.write.logSomething([1234n]);
        await blockchain.test.mine({ blocks: 1 });
        await wallet.public.waitForTransactionReceipt({ hash: call });
        await notEver(eventPromise);
    });

    it("doesn't return events with different topic", async () => {
        const eventPromise = new Promise((resolve) => {
            const unwatch = contract0.watchEvent.Log(
                {},
                {
                    pollingInterval: 100,
                    onLogs: (a) => {
                        unwatch();
                        resolve(a);
                    },
                },
            );
        });
        const call = await contract0.write.logSomethingElse([1234n]);
        await blockchain.test.mine({ blocks: 1 });
        await wallet.public.waitForTransactionReceipt({ hash: call });
        await notEver(eventPromise);
    });

    // Skipped because ambiguous: ethereum/execution-apis#288
    xit("behaves when given invalid block range", async () => {
        await assert.rejects(
            wallet.provider.request({
                method: "eth_newFilter",
                params: [{ fromBlock: "concrete", toBlock: "wood" }],
            }),
        );
    });
});
