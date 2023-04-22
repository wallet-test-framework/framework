import { ManualGlue } from "./glue";
import * as tests from "./tests";
import { Glue } from "@wallet-test-framework/glue";
import { ethers } from "ethers";
import "mocha/mocha.css";

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

        await blockchain.send("miner_stop", []);

        const network = await blockchain.getNetwork();

        const wallet = new ethers.BrowserProvider(window.ethereum, "any");

        let glue: Glue;
        const config = new URLSearchParams(window.location.hash);
        const wsGlueAddress = config.get("glue");

        if (wsGlueAddress) {
            throw new Error("not implemented");
        } else {
            const glueElem = document.getElementById("glue");
            if (!glueElem) {
                throw "no #glue element";
            }

            glue = new ManualGlue(glueElem, wallet);
        }

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

            await glue.activateChain({
                chainId: "0x" + network.chainId.toString(16),
                rpcUrl: rpcUrl.href,
            });

            const unsubscribe = glue.on("requestaccounts", (event) => {
                unsubscribe();
                glue.requestAccounts({
                    action: "approve",
                    id: event.id,
                    accounts: [event.accounts[0]],
                });
            });

            await wallet.send("eth_requestAccounts", []);
            unsubscribe();

            await tests.run(blockchain, wallet);
        };

        webSocket.addEventListener("open", open);
    });
}

main();
