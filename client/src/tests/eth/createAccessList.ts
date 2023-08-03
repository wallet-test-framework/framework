import { STORE_ABI, STORE_BYTECODE } from "../../contracts/getStorageAt.sol";
import * as tests from "../../tests";
import assert from "assert";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("createAccessList", () => {
    let contractAddress: `0x${string}`;

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
    });

    xit("returns the same access list as the client", async () => {
        const sender = (await blockchain.wallet.getAddresses())[0];
        const request = {
            method: "eth_createAccessList",
            params: [
                {
                    nonce: "0x01",
                    to: contractAddress,
                    from: sender,
                    gas: "0x7530",
                    value: "0x00",
                    // store (300)
                    input: "0x6057361d000000000000000000000000000000000000000000000000000000000000012c",
                },
            ],
        };

        const fromBlockchain: unknown = await blockchain.provider.request(
            request
        );
        const fromWallet: unknown = await wallet.provider.request(request);

        assert.deepEqual(fromBlockchain, fromWallet);
    });
});
