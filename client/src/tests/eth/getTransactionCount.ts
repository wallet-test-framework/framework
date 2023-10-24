import {
    DEPLOY_ABI,
    DEPLOY_BYTECODE,
} from "../../contracts/getTransactionCount.sol";
import * as tests from "../../tests";
import assert from "assert";
import * as viem from "viem";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getTransactionCount", () => {
    let contractAddress: `0x${string}`;
    let contract: viem.GetContractReturnType<
        typeof DEPLOY_ABI,
        typeof blockchain.public,
        typeof blockchain.wallet
    >;

    before(async () => {
        const contractHash = await blockchain.wallet.deployContract({
            abi: DEPLOY_ABI,
            gas: 130000n,
            bytecode: DEPLOY_BYTECODE,
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
            abi: DEPLOY_ABI,
        });
    });

    it("sending transaction from eoa increases nonce", async () => {
        const src = blockchain.wallet.account;
        const dest = wallet.wallet.account;

        const balance = 0x100000000000000000000n;
        await blockchain.test.setBalance({
            address: src.address,
            value: balance,
        });

        const walletInitalNonce = await wallet.public.getTransactionCount({
            address: src.address,
        });
        const ganacheInitalNonce = await blockchain.public.getTransactionCount({
            address: src.address,
        });

        assert.equal(
            walletInitalNonce,
            ganacheInitalNonce,
            "wallet's nonce matches ganache's before sending transaction",
        );

        const response = await blockchain.wallet.sendTransaction({
            to: dest.address,
            value: 0n,
        });

        await blockchain.test.mine({ blocks: 1 });

        await wallet.public.waitForTransactionReceipt({ hash: response });

        const walletFinalNonce = await wallet.public.getTransactionCount({
            address: src.address,
        });
        const ganacheFinalNonce = await blockchain.public.getTransactionCount({
            address: src.address,
        });

        assert.equal(
            walletFinalNonce,
            ganacheFinalNonce,
            "wallet's nonce matches ganache's after sending transaction",
        );

        const expected = 1 + walletInitalNonce;

        assert.equal(walletFinalNonce, expected);
    });

    it("deploying from contract increases nonce", async () => {
        const src = blockchain.wallet.account;

        const balance = 0x100000000000000000000n;
        await blockchain.test.setBalance({
            address: src.address,
            value: balance,
        });

        const walletInitalNonce = await wallet.public.getTransactionCount({
            address: contractAddress,
        });
        const ganacheInitalNonce = await blockchain.public.getTransactionCount({
            address: contractAddress,
        });

        assert.equal(
            walletInitalNonce,
            ganacheInitalNonce,
            "wallet's nonce matches ganache's before sending transaction",
        );

        const response = await contract.write.deploy();

        await blockchain.test.mine({ blocks: 1 });

        await wallet.public.waitForTransactionReceipt({ hash: response });

        const walletFinalNonce = await wallet.public.getTransactionCount({
            address: contractAddress,
        });
        const ganacheFinalNonce = await blockchain.public.getTransactionCount({
            address: contractAddress,
        });

        assert.equal(
            walletFinalNonce,
            ganacheFinalNonce,
            "wallet's nonce matches ganache's after sending transaction",
        );

        const expected = 1 + walletInitalNonce;

        assert.equal(walletFinalNonce, expected);
    });
});
