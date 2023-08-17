import { ManualGlue, WebSocketGlue } from "./glue";
import * as tests from "./tests";
import { spawn } from "./util";
import { Glue } from "@wallet-test-framework/glue";
import "mocha/mocha.css";
import * as viem from "viem";

type Eip1193Provider = Parameters<typeof viem.custom>[0];

export interface AccountChain<A extends undefined | viem.Account> {
    provider: Eip1193Provider;
    public: viem.PublicClient<viem.Transport, viem.Chain>;
    wallet: viem.WalletClient<viem.Transport, viem.Chain, A>;
}

export type Chain = AccountChain<viem.Account>;
export type AnyChain = AccountChain<undefined | viem.Account>;

export interface TestChain extends Chain {
    test: viem.TestClient<"ganache", viem.Transport, viem.Chain>;
}

export interface WalletChain extends Chain {
    glue: Glue;
}

declare global {
    interface Window {
        ethereum: Eip1193Provider;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = { method: string; params?: Array<any> | Record<string, any> };

class GanacheWorkerProvider implements Eip1193Provider {
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
            channel.port1.onmessage = (evt) => {
                const data: unknown = evt.data;
                if (!data || typeof data !== "object") {
                    return rej();
                }

                if ("result" in data) {
                    return res(data.result);
                } else if ("error" in data) {
                    return rej(data.error);
                } else {
                    return rej();
                }
            };
            channel.port1.onmessageerror = (evt) => rej(evt.data);
            this.worker.postMessage(request, [channel.port2]);
        });
    }
}

async function getAccount(provider: Eip1193Provider): Promise<`0x${string}`> {
    const maybeAccounts: unknown = await provider.request({
        method: "eth_accounts",
        params: [],
    });
    if (!(maybeAccounts instanceof Array)) {
        throw new Error("invalid accounts response");
    }
    if (typeof maybeAccounts[0] !== "string") {
        throw new Error("no account");
    }
    const address: string = maybeAccounts[0];
    if (!address.startsWith("0x")) {
        throw new Error("not an address");
    }
    return address as `0x${string}`;
}

function main() {
    const connect = document.getElementById("connect");

    if (!connect) {
        throw "no #connect element";
    }

    // Reload the page when the glue address changes.
    window.addEventListener("hashchange", () => window.location.reload());

    let webSocket: WebSocket | null;

    connect.addEventListener(
        "click",
        spawn(async () => {
            if (webSocket) {
                throw "Already Connected";
            }

            const chainId = Math.floor(Math.random() * 32767) + 32767;
            const options = { chainId: chainId };
            const chain = {
                id: chainId,
                name: "Test Chain",
                network: "test-chain",
                nativeCurrency: {
                    decimals: 18,
                    name: "testETH",
                    symbol: "teth",
                },
                rpcUrls: {
                    default: { http: [] },
                    public: { http: [] },
                },
            };

            const provider = new GanacheWorkerProvider(options);

            const transport = viem.custom(provider);

            const blockchain: TestChain = {
                provider,
                wallet: viem.createWalletClient({
                    chain,
                    transport,
                    pollingInterval: 0,
                    account: {
                        address: await getAccount(provider),
                        type: "json-rpc",
                    } as const,
                }),
                public: viem.createPublicClient({
                    chain,
                    transport,
                    pollingInterval: 0,
                }),
                test: viem.createTestClient({
                    mode: "ganache",
                    chain,
                    transport,
                    pollingInterval: 0,
                }),
            };

            await blockchain.test.setAutomine(false);

            const unboundWallet: AccountChain<undefined | viem.Account> = {
                provider: window.ethereum,
                wallet: viem.createWalletClient({
                    chain,
                    transport: viem.custom(window.ethereum),
                    pollingInterval: 0,
                }),
                public: viem.createPublicClient({
                    chain,
                    transport: viem.custom(window.ethereum),
                    pollingInterval: 0,
                }),
            };

            let glue: Glue;
            const config = new URLSearchParams(window.location.hash.slice(1));
            const wsGlueAddress = config.get("glue");

            if (wsGlueAddress) {
                glue = await WebSocketGlue.connect(wsGlueAddress);
            } else {
                const glueElem = document.getElementById("container");
                if (!glueElem) {
                    throw "no #container element";
                }

                glue = new ManualGlue(glueElem, unboundWallet);
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

                    let params: unknown[];
                    if ("params" in msg.body) {
                        if (!(msg.body.params instanceof Array)) {
                            throw new TypeError(
                                "'params' in body not an array"
                            );
                        }

                        params = msg.body.params;
                    } else {
                        params = [];
                    }

                    if (!("number" in msg)) {
                        throw new TypeError("'number' not in message body");
                    }

                    try {
                        result.result = await blockchain.provider.request({
                            method: msg.body.method,
                            params,
                        });
                    } catch (error: unknown) {
                        result.error = error;
                    }

                    webSocket?.send(
                        JSON.stringify({
                            number: msg.number,
                            result: { jsonrpc: "2.0", ...result },
                        })
                    );
                })
            );

            const open = spawn(async () => {
                webSocket?.removeEventListener("open", open);

                await glue.activateChain({
                    chainId: "0x" + chainId.toString(16),
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

                await unboundWallet.wallet.requestAddresses();
                unsubscribe();
                if (requestAccountsPromise instanceof Promise) {
                    await requestAccountsPromise;
                }

                const wallet: WalletChain = {
                    provider: window.ethereum,
                    wallet: viem.createWalletClient({
                        chain,
                        transport: viem.custom(window.ethereum),
                        account: {
                            address: await getAccount(window.ethereum),
                            type: "json-rpc",
                        } as viem.Account,
                        pollingInterval: 0,
                    }),
                    public: viem.createPublicClient({
                        chain,
                        transport: viem.custom(window.ethereum),
                        pollingInterval: 0,
                    }),
                    glue,
                };

                await tests.run(blockchain, wallet);
            });

            webSocket.addEventListener("open", open);
        })
    );
}

main();
