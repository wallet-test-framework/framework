import * as tests from "./tests";
import { ethers } from "ethers";
import Ganache from "ganache";
import "mocha/mocha.css";

declare global {
    interface Window {
        ethereum: ethers.Eip1193Provider;
    }
}

async function main() {
    const connect = document.getElementById("connect");

    if (!connect) {
        throw "no #connect element";
    }

    let webSocket: WebSocket | null;

    connect.addEventListener("click", async () => {
        if (webSocket) {
            throw "Already Connected";
        }

        const chainId = Math.floor(Math.random() * 32767) + 32767;
        const options = { chainId: chainId };
        const blockchain = new ethers.BrowserProvider(
            Ganache.provider(options)
        );

        const network = await blockchain.getNetwork();

        const wallet = new ethers.BrowserProvider(window.ethereum, "any");

        const uuid = crypto.randomUUID();

        const wsUrl = new URL(`./${uuid}`, window.location.href);
        wsUrl.protocol = wsUrl.protocol == "http:" ? "ws:" : "wss:";
        wsUrl.hash = "";

        const rpcUrl = new URL(`./rpc/${uuid}`, window.location.href);

        webSocket = new WebSocket(wsUrl.href);

        webSocket.addEventListener("message", async (event) => {
            const msg = JSON.parse(event.data);
            console.log("received:", msg);

            const response = await blockchain.send(
                msg.body.method,
                msg.body.params
            );
            webSocket?.send(
                JSON.stringify({
                    number: msg.number,
                    result: {
                        id: msg.body.id,
                        result: response,
                    },
                })
            );
        });

        const open = async () => {
            webSocket?.removeEventListener("open", open);

            await wallet.send("wallet_addEthereumChain", [
                {
                    chainId: "0x" + network.chainId.toString(16),
                    chainName: `Test Chain ${network.chainId}`,
                    nativeCurrency: {
                        name: "teth",
                        symbol: "teth",
                        decimals: 18,
                    },
                    rpcUrls: [rpcUrl.href],
                },
            ]);

            await wallet.send("wallet_switchEthereumChain", [
                {
                    chainId: "0x" + network.chainId.toString(16),
                },
            ]);

            await wallet.send("eth_requestAccounts", []);

            await tests.run(blockchain, wallet);
        };

        webSocket.addEventListener("open", open);
    });
}

main();
