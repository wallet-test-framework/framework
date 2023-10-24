import { STORE_ABI, STORE_BYTECODE } from "../../contracts/getStorageAt.sol";
import * as tests from "../../tests";
import assert from "assert";
import * as viem from "viem";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getStorageAt", () => {
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

    it("returns zero for an empty account", async () => {
        const storage = await wallet.public.getStorageAt({
            address: "0x0000000000000000000000000000000000000000",
            slot: "0x00",
        });

        assert.equal(storage, "0x");
    });

    it("returns the correct value for a contract", async () => {
        const storage = await wallet.public.getStorageAt({
            address: contractAddress,
            slot: "0x00",
        });

        assert.equal(storage, "0x");
        const response = await contract.write.store([0x89n]);

        await blockchain.test.mine({ blocks: 1 });

        await wallet.public.waitForTransactionReceipt({ hash: response });
        const storageAfter = await wallet.public.getStorageAt({
            address: contractAddress,
            slot: "0x00",
        });

        assert.equal(
            storageAfter,
            "0x0000000000000000000000000000000000000000000000000000000000000089",
        );
    });
});
