import * as tests from "../../tests";
import { notEver } from "../../util";
import newFilter from "./newFilter.sol";
import assert from "assert";
import { ethers } from "ethers";

const blockchain = tests.blockchain;
const wallet = tests.wallet;

if (!blockchain || !wallet) {
    throw "not ready";
}

describe("newFilter", () => {
    let contract: ethers.Contract;
    let contract2: ethers.Contract;

    before(async () => {
        const deployer = (await blockchain.listAccounts())[0];
        const factory = ethers.ContractFactory.fromSolidity(
            newFilter.Emit,
            deployer
        );

        contract = await factory.deploy();
        contract2 = await factory.deploy();
        await blockchain.send("evm_mine", [{ blocks: 1 }]);
        await contract.deploymentTransaction()?.wait(1);
        await contract2.deploymentTransaction()?.wait(1);
    });

    it("returns events matching filter", async () => {
        const eventPromise = new Promise(
            (resolve) => void contract.once("Log", (args) => resolve(args))
        );
        const call = await contract.logSomething(1234n);
        await blockchain.send("evm_mine", [{ blocks: 1 }]);
        await call.wait(1);
        const actual = await eventPromise;
        assert.equal(actual, 1234n);
    });

    it("doesn't return events from different contract", async () => {
        const eventPromise = new Promise(
            (resolve) => void contract2.once("Log", (args) => resolve(args))
        );
        const call = await contract.logSomething(1234n);
        await blockchain.send("evm_mine", [{ blocks: 1 }]);
        await call.wait(1);
        await notEver(eventPromise);
    });

    it("doesn't return events with different topic", async () => {
        const eventPromise = new Promise(
            (resolve) => void contract.once("Log", (args) => resolve(args))
        );
        const call = await contract.logSomethingElse(1234n);
        await blockchain.send("evm_mine", [{ blocks: 1 }]);
        await call.wait(1);
        await notEver(eventPromise);
    });
});
