import Ganache from "ganache";
import { ethers } from "ethers";
import * as tests from "./tests";

declare global {
	interface Window {
		ethereum: any;
	}
}

async function main() {
	const connect = document.getElementById("connect");
	let webSocket: WebSocket | null;

	connect.addEventListener("click", async() => {
		if (webSocket) {
			throw "Already Connected"
		}

		const chainId = Math.floor(Math.random() * 32767) + 32767;
		const options = {chainId: chainId};
		const blockchain = new ethers.providers.Web3Provider(Ganache.provider(options));

		const network = await blockchain.getNetwork();

		const wallet = new ethers.providers.Web3Provider(window.ethereum, "any");

		webSocket = new WebSocket("ws://127.0.0.1:3001");

		webSocket.addEventListener('message', async(event) => {
			const msg = JSON.parse(event.data);
			console.log('received:', msg);

			switch (msg.kind) {
				case "open":
					await wallet.send("wallet_addEthereumChain", [{
						chainId: "0x" + network.chainId.toString(16),
						chainName: "Test Chain",
						nativeCurrency: {
							name: "teth",
							symbol: "teth",
							decimals: 18
						},
						rpcUrls: [new URL(msg.body, document.baseURI).href]
					}]);

					await wallet.send("wallet_switchEthereumChain", [{
						chainId: "0x" + network.chainId.toString(16)
					}])

					await tests.run(blockchain, wallet);

					break;

				case "request":
					const response = await blockchain.send(msg.body.call.method, msg.body.call.params);
					await webSocket.send(JSON.stringify({
						kind: "reply",
						body: {
							number: msg.body.number,
							result: {
								id: msg.body.call.id,
								result: response,
							}
						}
					}))

					break;
			}
		});

	})
}

main()