import { ethers } from "ethers";
import { report, hold } from "zora";
import { createTAPReporter } from "zora-reporters"

export let wallet: ethers.providers.Web3Provider | null;
export let blockchain: ethers.providers.Web3Provider | null;

hold();

export async function run(myBlockchain: ethers.providers.Web3Provider, myWallet: ethers.providers.Web3Provider) {
	wallet = myWallet;
	blockchain = myBlockchain;

	await import("./tests/getBalance")

	const reporter = createTAPReporter();
	report({reporter});
}