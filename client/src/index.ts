import { ManualGlue } from "./glue";
import * as tests from "./tests";
import { spawn } from "./util";
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

function main() {
    const connect = document.getElementById("connect");

    if (!connect) {
        throw "no #connect element";
    }

    let webSocket: WebSocket | null;

    connect.addEventListener(
        "click",
        spawn(async () => {
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
                const glueElem = document.getElementById("container");
                if (!glueElem) {
                    throw "no #container element";
                }

                glue = new ManualGlue(glueElem, wallet);
            }

            const uuid = crypto.randomUUID();

            const wsUrl = new URL(`./${uuid}`, window.location.href);
            wsUrl.protocol = wsUrl.protocol == "http:" ? "ws:" : "wss:";
            wsUrl.hash = "";

            const rpcUrl = new URL(`./rpc/${uuid}`, window.location.href);

            webSocket = new WebSocket(wsUrl.href);

            webSocket.addEventListener(
                "message",
                spawn(async (event) => {
                    if (typeof event.data !== "string") {
                        throw new TypeError("WebSocket message not string");
                    }

                    const msg: unknown = JSON.parse(event.data);
                    console.log("received:", msg);

                    const result: { [key: string]: unknown } = {};

                    if (!msg || typeof msg !== "object") {
                        throw new TypeError("received message not object");
                    }

                    if (!("body" in msg) || !msg.body) {
                        throw new TypeError("'body' not in received message");
                    }

                    if (typeof msg.body !== "object") {
                        throw new TypeError("'body' not an object");
                    }

                    if ("id" in msg.body) {
                        result.id = msg.body.id;
                    }

                    if (!("method" in msg.body)) {
                        throw new TypeError("'method' not in message body");
                    }

                    if (typeof msg.body.method !== "string") {
                        throw new TypeError("'method' in body not a string");
                    }

                    if (!("params" in msg.body)) {
                        throw new TypeError("'params' not in message body");
                    }

                    if (!(msg.body.params instanceof Array)) {
                        throw new TypeError("'params' in body not an array");
                    }

                    if (!("number" in msg)) {
                        throw new TypeError("'number' not in message body");
                    }

                    result.response = await blockchain.send(
                        msg.body.method,
                        msg.body.params
                    );
                    webSocket?.send(
                        JSON.stringify({
                            number: msg.number,
                            result,
                        })
                    );
                })
            );

            const open = spawn(async () => {
                webSocket?.removeEventListener("open", open);

                await glue.activateChain({
                    chainId: "0x" + network.chainId.toString(16),
                    rpcUrl: rpcUrl.href,
                });

                let requestAccountsPromise: unknown = null;
                const unsubscribe = glue.on("requestaccounts", (event) => {
                    unsubscribe();
                    requestAccountsPromise = glue.requestAccounts({
                        action: "approve",
                        id: event.id,
                        accounts: [event.accounts[0]],
                    });
                });

                await wallet.send("eth_requestAccounts", []);
                unsubscribe();
                if (requestAccountsPromise instanceof Promise) {
                    await requestAccountsPromise;
                }

                await tests.run(blockchain, wallet);
            });

            webSocket.addEventListener("open", open);
        })
    );
}

main();
