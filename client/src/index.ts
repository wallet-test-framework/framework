import * as tests from "./tests";
import { ethers } from "ethers";
import "mocha/mocha.css";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

declare global {
    interface Window {
        ethereum: ethers.Eip1193Provider;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = { method: string; params?: Array<any> | Record<string, any> };

class GanacheWorkerProvider implements ethers.Eip1193Provider {
    private worker: Worker;

    constructor(options: object) {
        const url = new URL("./worker_chain.js", import.meta.url);
        this.worker = new Worker(url);
        this.worker.postMessage(options);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public request(request: Request): Promise<any> {
        return new Promise((res, rej) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (evt) => res(evt.data);
            channel.port1.onmessageerror = (evt) => rej(evt.data);
            this.worker.postMessage(request, [channel.port2]);
        });
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
            new GanacheWorkerProvider(options)
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

            let switched = false;
            do {
                try {
                    await wallet.send("wallet_switchEthereumChain", [
                        {
                            chainId: "0x" + network.chainId.toString(16),
                        },
                    ]);
                    switched = true;
                } catch (e: unknown) {
                    if (e instanceof Error && "error" in e) {
                        if (e.error instanceof Object && "code" in e.error) {
                            if (e.error.code === 4902) {
                                await delay(1000);
                                continue;
                            }
                        }
                    }

                    throw e;
                }
            } while (!switched);

            await wallet.send("eth_requestAccounts", []);

            await tests.run(blockchain, wallet);
        };

        webSocket.addEventListener("open", open);
    });
}

main();
