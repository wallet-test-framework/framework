import { ClientState } from "./client.js";
import { LRUCache } from "lru-cache";
import { Buffer } from "node:buffer";
import { ServerResponse } from "node:http";
import { WebSocket } from "ws";

class Pending {
    private _bytes = 0;
    public readonly pending: Array<[Buffer, ServerResponse]> = [];

    public get bytes(): number {
        return this._bytes;
    }

    private evict(): void {
        const shifted = this.pending.shift();
        if (!shifted) {
            return;
        }

        const [buffer, response] = shifted;
        this._bytes -= buffer.length;

        console.debug("Evicting pending request");

        // Send back an error.
        response
            .writeHead(504, "too many pending requests", {
                "Content-Type": "application/json",
            })
            .end(
                JSON.stringify({
                    jsonrpc: "2.0",
                    error: {
                        code: -32603,
                        message: "wtf: too many pending requests",
                    },
                    id: null,
                })
            );
    }

    public push(request: Buffer, response: ServerResponse): void {
        if (request.length > Connections.MAX_BYTES) {
            // Send back an error.
            response
                .writeHead(413, "request too large", {
                    "Content-Type": "application/json",
                })
                .end(
                    JSON.stringify({
                        jsonrpc: "2.0",
                        error: {
                            code: -32603,
                            message: "wtf: request too large",
                        },
                        id: null,
                    })
                );
            return;
        }

        this.pending.push([request, response]);
        this._bytes += request.length;

        while (this._bytes > Connections.MAX_BYTES) {
            this.evict();
        }
    }

    public dispose(): void {
        while (this.pending.length > 0) {
            this.evict();
        }
    }
}

type MaybeClient = ClientState | Pending;

export class Connections {
    readonly connections: LRUCache<string, MaybeClient>;

    public static MAX_BYTES = 16 * 1024 * 1024;

    constructor() {
        this.connections = new LRUCache({
            max: 32,
            dispose: this.disposeConnection,
        });
    }

    private disposeConnection(value: MaybeClient, key: string): void {
        console.debug("Evicting connection", key);
        value.dispose();
    }

    public rpcRequest(
        key: string,
        request: Buffer,
        response: ServerResponse
    ): void {
        let maybeClient = this.connections.get(key);

        if (maybeClient instanceof ClientState) {
            console.debug("Proxying request", key);
            maybeClient.request(request, response);
            return;
        }

        if (!maybeClient) {
            maybeClient = new Pending();
            this.connections.set(key, maybeClient);
        }

        console.debug("Queuing request", key);
        maybeClient.push(request, response);
    }

    public wsConnect(key: string, ws: WebSocket): void {
        ws.on("close", () => this.delete(key));
        ws.on("error", () => this.delete(key));

        const state = new ClientState(ws);
        const maybeClient = this.connections.get(key);

        if (maybeClient instanceof ClientState) {
            // Assume the existing connection is the "real" one.
            ws.close();
            return;
        } else if (maybeClient instanceof Pending) {
            // Send pending requests.
            for (const [request, response] of maybeClient.pending) {
                state.request(request, response);
            }
        }

        this.connections.set(key, state);
    }

    private delete(key: string): void {
        console.debug("Deleting connection", key);

        const maybeClient = this.connections.get(key);
        if (!maybeClient) {
            return;
        }

        this.connections.delete(key);
        maybeClient.dispose(); // TODO: Sends the wrong error code & message.
    }
}
