import { STORE_ABI, STORE_BYTECODE } from "../../contracts/getStorageAt.sol";
import * as tests from "../../tests";
import assert from "assert";
import * as viem from "viem";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

function asProof(input: unknown): {
    codeHash: string;
    storageProof: Array<{ value: string }>;
} {
    if (!input || typeof input !== "object") {
        throw "response not an object";
    }

    if (!("codeHash" in input)) {
        throw "missing codehash";
    }

    const codeHash = input.codeHash;

    if (!codeHash || typeof codeHash !== "string") {
        throw "bad codehash";
    }

    if (!("storageProof" in input)) {
        throw "missing storage proof";
    }

    const storageProof = input.storageProof;

    if (!Array.isArray(storageProof)) {
        throw "bad storage proof";
    }

    for (const x of storageProof) {
        if (typeof x !== "object") {
            throw "bad proof";
        }

        const obj: object = x as object;

        if (!("value" in obj) || typeof obj.value !== "string") {
            throw "bad proof";
        }
    }

    return {
        ...input,
        codeHash,
        storageProof,
    };
}

describe("getProof", () => {
    let contractAddress: `0x${string}`;
    let contract: viem.GetContractReturnType<
        typeof STORE_ABI,
        typeof blockchain.public,
        typeof blockchain.wallet
    >;

    before(async () => {
        const contractHash = await blockchain.wallet.deployContract({
            abi: STORE_ABI,
            bytecode: STORE_BYTECODE,
            gas: 150000n,
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
            publicClient: blockchain.public,
            walletClient: blockchain.wallet,
            address,
            abi: STORE_ABI,
        });
    });

    it("returns a proof matching client for EOA", async () => {
        const blockNumber = await blockchain.public.getBlockNumber();

        const fromBlockchain = asProof(
            await blockchain.provider.request({
                method: "eth_getProof",
                params: [
                    "0x0000000000000000000000000000000000000000",
                    ["0x00"],
                    blockNumber.toString(16),
                ],
            })
        );

        const fromWallet = asProof(
            await wallet.provider.request({
                method: "eth_getProof",
                params: [
                    "0x0000000000000000000000000000000000000000",
                    ["0x00"],
                    blockNumber.toString(16),
                ],
            })
        );

        assert.deepEqual(fromWallet, fromBlockchain);
        assert.equal(
            fromWallet.codeHash,
            "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
        );
        assert.equal(fromWallet.storageProof.length, 1);
    });

    it("returns the correct value for a contract", async () => {
        const blockNumber = await blockchain.public.getBlockNumber();

        const storage = await wallet.public.getStorageAt({
            address: contractAddress,
            slot: "0x00",
        });

        assert.equal(storage, "0x");

        const response = await contract.write.store([0x89n]);

        await blockchain.test.mine({ blocks: 1 });

        await wallet.public.waitForTransactionReceipt({ hash: response });

        const nextBlockNumberHex = "0x" + (blockNumber + 1n).toString(16);
        const fromBlockchain = asProof(
            await blockchain.provider.request({
                method: "eth_getProof",
                params: [contractAddress, ["0x00"], nextBlockNumberHex],
            })
        );

        const fromWallet = asProof(
            await wallet.provider.request({
                method: "eth_getProof",
                params: [contractAddress, ["0x00"], nextBlockNumberHex],
            })
        );

        assert.deepEqual(fromWallet, fromBlockchain);
        assert.equal(
            fromWallet.codeHash,
            "0x64c4775c8291ba05add5689df55b0662da1e1608c70cf6ac1ab76be406ce9a0d"
        );
        assert.equal(fromWallet.storageProof.length, 1);
        assert.equal(fromWallet.storageProof[0].value, "0x89");
    });
});
