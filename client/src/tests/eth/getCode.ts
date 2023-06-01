import { RECEIVE_ABI, RECEIVE_BYTECODE } from "../../contracts/getBalance.sol";
import * as tests from "../../tests";
import assert from "assert";
import * as viem from "viem";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getCode", () => {
    let contractAddress: `0x${string}`;
    let contract: viem.GetContractReturnType<
        typeof RECEIVE_ABI,
        typeof blockchain.public,
        typeof blockchain.wallet
    >;

    before(async () => {
        const contractHash = await blockchain.wallet.deployContract({
            abi: RECEIVE_ABI,
            bytecode: RECEIVE_BYTECODE,
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
            abi: RECEIVE_ABI,
        });
    });

    it("returns the bytecode of a contract", async () => {
        const walletBytecode =  await wallet.public.getBytecode({address: contractAddress});
        const blockchainBytecode =  await blockchain.public.getBytecode({address: contractAddress});


        assert.equal(walletBytecode, blockchainBytecode);
    });
});
