import * as tests from "../../tests";
import Receive from "./getBalance.sol";
import assert from "assert";
import { ethers } from "ethers";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("getBalance", () => {
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

    it("sending ether to address increases balance", async () => {
        const src = (await blockchain.listAccounts())[0];
        const dest = (await wallet.listAccounts())[0];

        const balance = "0x100000000000000000000";
        await blockchain.send("evm_setAccountBalance", [src.address, balance]);

        const walletInitalBalance = await wallet.getBalance(dest.address);
        const ganacheInitalBalance = await blockchain.getBalance(dest.address);

        assert.equal(
            walletInitalBalance.toString(),
            ganacheInitalBalance.toString(),
            "initalBalance"
        );

        const value = 1n;
        const response = await src.sendTransaction({
            to: dest,
            value: value,
        });

        await blockchain.send("evm_mine", [{ blocks: 5000 }]);

        const transaction = await wallet.getTransaction(response.hash);
        if (!transaction) {
            throw "no transaction";
        }
        await transaction.wait(10);

        const walletFinalBalance = await wallet.getBalance(dest.address);
        const ganacheFinalBalance = await blockchain.getBalance(dest.address);

        assert.equal(
            walletFinalBalance.toString(),
            ganacheFinalBalance.toString(),
            "finalBalance"
        );

        const expected = value + walletInitalBalance;

        assert.equal(walletFinalBalance, expected);
    });

    it("sending ether to contract increases balance", async () => {
        const src = (await blockchain.listAccounts())[0];

        const balance = "0x100000000000000000000";
        await blockchain.send("evm_setAccountBalance", [src.address, balance]);

        const walletInitalBalance = await wallet.getBalance(contract);
        const ganacheInitalBalance = await blockchain.getBalance(contract);

        assert.equal(
            walletInitalBalance.toString(),
            ganacheInitalBalance.toString(),
            "initalBalance"
        );

        const value = 1n;
        const response = await contract.give({ value });

        await blockchain.send("evm_mine", [{ blocks: 5000 }]);

        const transaction = await wallet.getTransaction(response.hash);
        if (!transaction) {
            throw "no transaction";
        }
        await transaction.wait(10);

        const walletFinalBalance = await wallet.getBalance(contract);
        const ganacheFinalBalance = await blockchain.getBalance(contract);

        assert.equal(
            walletFinalBalance.toString(),
            ganacheFinalBalance.toString(),
            "finalBalance"
        );

        const expected = value + walletInitalBalance;

        assert.equal(walletFinalBalance, expected);
    });
});
