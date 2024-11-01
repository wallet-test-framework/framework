import { ManualGlue, WebSocketGlue } from "./glue";
import * as tests from "./tests";
import { retry, spawn } from "./util";
import { Glue } from "@wallet-test-framework/glue";
import { EthereumProvider } from "@walletconnect/ethereum-provider";
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
    const walletconnect = document.getElementById("walletConnect");

    if (!connect) {
        throw "no #connect element";
    }

    if (!walletconnect) {
        throw "no #walletConnect element";
    }

    // Reload the page when the glue address changes.
    window.addEventListener("hashchange", () => window.location.reload());

    let webSocket: WebSocket | null;
    const chainId = Math.floor(Math.random() * 32767) + 32767;

    const uuid = crypto.randomUUID();
    const rpcUrl = new URL(`./rpc/${uuid}`, window.location.href);

    async function run(baseProvider: Parameters<typeof viem.custom>[0]) {
        if (webSocket) {
            throw "Already Connected";
        }

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
            provider: baseProvider,
            wallet: viem.createWalletClient({
                chain,
                transport: viem.custom(baseProvider),
                pollingInterval: 0,
            }),
            public: viem.createPublicClient({
                chain,
                transport: viem.custom(baseProvider),
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

        const wsUrl = new URL(`./${uuid}`, window.location.href);
        wsUrl.protocol = wsUrl.protocol == "http:" ? "ws:" : "wss:";
        wsUrl.hash = "";

        webSocket = new WebSocket(wsUrl.href);

        webSocket.addEventListener(
            "message",
            spawn(async (event) => {
                if (typeof event.data !== "string") {
                    throw new TypeError("WebSocket message not string");
                }

                const msg: unknown = JSON.parse(event.data);
                console.log("received:", msg);

                if (!msg || typeof msg !== "object") {
                    throw new TypeError("received message not object");
                }

                if (!("body" in msg) || !msg.body) {
                    throw new TypeError("'body' not in received message");
                }

                if (typeof msg.body !== "object") {
                    throw new TypeError("'body' not an object");
                }

                let requests: Array<unknown>;
                let batch: boolean;
                if (msg.body instanceof Array) {
                    requests = msg.body;
                    batch = true;
                } else {
                    requests = [msg.body];
                    batch = false;
                }

                if (!("number" in msg)) {
                    throw new TypeError("'number' not in message body");
                }

                const responses = [];
                for (const request of requests) {
                    const response: { [key: string]: unknown } = {};

                    if (!request || typeof request !== "object") {
                        throw new TypeError("received request not object");
                    }

                    if ("id" in request) {
                        response.id = request.id;
                    }

                    if (!("method" in request)) {
                        throw new TypeError("'method' not in request");
                    }

                    if (typeof request.method !== "string") {
                        throw new TypeError("request 'method' not a string");
                    }

                    let params: unknown[] | object;
                    if ("params" in request) {
                        if (
                            !request.params ||
                            typeof request.params !== "object"
                        ) {
                            throw new Error(
                                "request 'params' not an array or object",
                            );
                        }
                        params = request.params;
                    } else {
                        params = [];
                    }

                    try {
                        response.result = await blockchain.provider.request({
                            method: request.method,
                            params,
                        });
                    } catch (error: unknown) {
                        response.error = error;
                    }

                    responses.push({ jsonrpc: "2.0", ...response });
                }

                const result = batch ? responses : responses[0];

                webSocket?.send(
                    JSON.stringify({
                        number: msg.number,
                        result,
                    }),
                );
            }),
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

            await retry({
                totalMillis: 10 * 60 * 1000,
                operation: async () => {
                    const walletChain = await unboundWallet.public.getChainId();
                    if (chainId === walletChain) {
                        return;
                    }

                    console.log(
                        "switching from chain id",
                        walletChain,
                        "to",
                        chainId,
                    );

                    await unboundWallet.wallet.switchChain({ id: chainId });
                    // TODO: This likely will need a glue event.

                    throw new Error(
                        `want chain ${chainId} but got chain ${walletChain}`,
                    );
                },
            });

            const wallet: WalletChain = {
                provider: baseProvider,
                wallet: viem.createWalletClient({
                    chain,
                    transport: viem.custom(baseProvider),
                    account: {
                        address: await getAccount(baseProvider),
                        type: "json-rpc",
                    } as viem.Account,
                    pollingInterval: 0,
                }),
                public: viem.createPublicClient({
                    chain,
                    transport: viem.custom(baseProvider),
                    pollingInterval: 0,
                }),
                glue,
            };

            const report = await tests.run(blockchain, wallet);
            await glue.report(report);
        });

        webSocket.addEventListener("open", open);
    }

    connect.addEventListener(
        "click",
        spawn(async () => await run(window.ethereum)),
    );

    walletconnect.addEventListener(
        "click",
        spawn(async () => {
            const rpcMap: { [key: string]: string } = {};
            rpcMap[chainId.toString()] = rpcUrl.href;
            const provider = await EthereumProvider.init({
                projectId: "bb26a8cd7dd09815be4295a0b57c3819",
                metadata: {
                    name: "Wallet Test Framework",
                    description: "Wallet Test Framework",
                    url: "https://wallet-test-framework.herokuapp.com/", // origin must match your domain & subdomain
                    icons: [
                        "https://raw.githubusercontent.com/wallet-test-framework/framework/master/docs/img/logo.svg",
                    ],
                },
                showQrModal: true,
                optionalChains: [chainId],

                rpcMap: rpcMap,
            });

            await provider.connect();

            await run(provider);
        }),
    );
}

main();
