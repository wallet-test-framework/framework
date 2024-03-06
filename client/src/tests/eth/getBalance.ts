import { RECEIVE_ABI, RECEIVE_BYTECODE } from "../../contracts/getBalance.sol";
import * as tests from "../../tests";
import assert from "assert";
import * as viem from "viem";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getBalance", () => {
    let contractAddress: `0x${string}`;
    let contract: viem.GetContractReturnType<
        typeof RECEIVE_ABI,
        {
            public: typeof blockchain.public;
            wallet: typeof blockchain.wallet;
        }
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
            client: {
                public: blockchain.public,
                wallet: blockchain.wallet,
            },
            address,
            abi: RECEIVE_ABI,
        });
    });

    it("sending ether to address increases balance", async () => {
        const src = (await blockchain.wallet.getAddresses())[0];
        const dest = (await wallet.wallet.getAddresses())[0];

        const balance = 0x100000000000000000000n;
        await blockchain.test.setBalance({ address: src, value: balance });

        const walletInitalBalance = await wallet.public.getBalance({
            address: dest,
        });
        const ganacheInitalBalance = await blockchain.public.getBalance({
            address: dest,
        });

        assert.equal(
            walletInitalBalance.toString(),
            ganacheInitalBalance.toString(),
            "initalBalance",
        );

        const value = 1n;
        const response = await blockchain.wallet.sendTransaction({
            account: src,
            to: dest,
            value: value,
        });

        await blockchain.test.mine({ blocks: 5000 });
        await wallet.public.waitForTransactionReceipt({ hash: response });

        const walletFinalBalance = await wallet.public.getBalance({
            address: dest,
        });
        const ganacheFinalBalance = await blockchain.public.getBalance({
            address: dest,
        });

        assert.equal(
            walletFinalBalance.toString(),
            ganacheFinalBalance.toString(),
            "finalBalance",
        );

        const expected = value + walletInitalBalance;

        assert.equal(walletFinalBalance, expected);
    });

    it("sending ether to contract increases balance", async () => {
        const src = (await blockchain.wallet.getAddresses())[0];

        const balance = 0x100000000000000000000n;
        await blockchain.test.setBalance({ address: src, value: balance });

        const walletInitalBalance = await wallet.public.getBalance({
            address: contractAddress,
        });
        const ganacheInitalBalance = await blockchain.public.getBalance({
            address: contractAddress,
        });

        assert.equal(
            walletInitalBalance.toString(),
            ganacheInitalBalance.toString(),
            "initalBalance",
        );

        const value = 1n;
        const response = await contract.write.give({ value });

        await blockchain.test.mine({ blocks: 5000 });

        await wallet.public.waitForTransactionReceipt({ hash: response });

        const walletFinalBalance = await wallet.public.getBalance({
            address: contractAddress,
        });
        const ganacheFinalBalance = await blockchain.public.getBalance({
            address: contractAddress,
        });

        assert.equal(
            walletFinalBalance.toString(),
            ganacheFinalBalance.toString(),
            "finalBalance",
        );

        const expected = value + walletInitalBalance;

        assert.equal(walletFinalBalance, expected);
    });
});
