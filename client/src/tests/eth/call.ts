import { CALL_ABI, CALL_BYTECODE } from "../../contracts/call.sol";
import * as tests from "../../tests";
import assert from "assert";
import * as viem from "viem";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("call", () => {
    let contract0: viem.GetContractReturnType<
        typeof CALL_ABI,
        typeof wallet.public,
        typeof wallet.wallet
    >;

    before(async () => {
        const contractHash0 = await blockchain.wallet.deployContract({
            abi: CALL_ABI,
            bytecode: CALL_BYTECODE,
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
            publicClient: wallet.public,
            walletClient: wallet.wallet,
            address: address0,
            abi: CALL_ABI,
        });
    });

    it("returns the result of calling a contract", async () => {
        const call = await contract0.read.add1([1234n]);

        assert.equal(call, 1235n);
    });
});
