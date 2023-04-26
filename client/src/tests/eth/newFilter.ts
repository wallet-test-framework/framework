import { blockchain, wallet } from "../../tests";
import newFilter from "./newFilter.sol";
import assert from "assert";
import { ethers } from "ethers";

describe("newFilter", () => {
    let contract: ethers.Contract;

    before(async () => {
        if (!blockchain || !wallet) {
            throw "not ready";
        }
        const deployer = (await blockchain.listAccounts())[0];
        const factory = ethers.ContractFactory.fromSolidity(
            newFilter.Emit,
            deployer
        );

        contract = await factory.deploy();
        await blockchain.send("evm_mine", [{ blocks: 1 }]);
        await contract.deploymentTransaction()?.wait(1);
    });

    it("returns events matching filter", async () => {
        if (!blockchain || !wallet) {
            throw "not ready";
        }
        const eventPromise = new Promise((resolve) =>
            contract.once("Log", (args) => {
                resolve(args);
            })
        );
        const call = await contract.logSomething(1234n);
        await blockchain.send("evm_mine", [{ blocks: 1 }]);
        await call.wait(1);
        const actual = await eventPromise;
        assert.equal(actual, 1234n);
    });
});
