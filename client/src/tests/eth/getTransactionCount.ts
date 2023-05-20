import * as tests from "../../tests";
import Receive from "./getBalance.sol";
import assert from "assert";
import { ethers } from "ethers";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getTransactionCount", () => {
    let contract: ethers.Contract;
    before(async () => {
        const deployer = (await blockchain.listAccounts())[0];
        const factory = ethers.ContractFactory.fromSolidity(
            Receive.Receive,
            deployer
        );

        contract = await factory.deploy();
        await blockchain.send("evm_mine", [{ blocks: 1 }]);
        await contract.deploymentTransaction()?.wait(1);
    });

    it("sending transaction from eoa increases nonce", async () => {
        const src = (await blockchain.listAccounts())[0];
        const dest = (await wallet.listAccounts())[0];

        const balance = "0x100000000000000000000";
        await blockchain.send("evm_setAccountBalance", [src.address, balance]);

        const walletInitalNonce = await wallet.getTransactionCount(src.address);
        const ganacheInitalNonce = await blockchain.getTransactionCount(
            src.address
        );

        assert.equal(
            walletInitalNonce.toString(),
            ganacheInitalNonce.toString(),
            "wallet's nonce matches ganache's before sending transaction"
        );

        const response = await src.sendTransaction({
            to: dest,
            value: 0n,
        });

        await blockchain.send("evm_mine", [{ blocks: 1 }]);

        const transaction = await wallet.getTransaction(response.hash);
        if (!transaction) {
            throw "no transaction";
        }
        console.log(transaction);
        await transaction.wait(1);

        const walletFinalNonce = await wallet.send("eth_getTransactionCount", [
            src.address,
        ]);
        const ganacheFinalNonce = await blockchain.send(
            "eth_getTransactionCount",
            [src.address]
        );

        assert.equal(
            walletFinalNonce.toString(),
            ganacheFinalNonce.toString(),
            "wallet's nonce matches ganache's after sending transaction"
        );

        const expected = 1 + walletInitalNonce;

        assert.equal(walletFinalNonce, expected);
    });
});
