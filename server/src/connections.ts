import { ClientState } from "./client.js";
import { LRUCache } from "lru-cache";
import { Buffer } from "node:buffer";
import { ServerResponse } from "node:http";
import { WebSocket } from "ws";

export class Connections {
    readonly connections: LRUCache<string, ClientState>;

    constructor() {
        this.connections = new LRUCache({
            max: 32,
            dispose: (value, key) => this.disposeConnection(value, key),
        });
    }

    private disposeConnection(value: ClientState, key: string): void {
        console.debug("Evicting connection", key);
        value.dispose();
    }

    public rpcRequest(
        key: string,
        request: Buffer,
        response: ServerResponse
    ): void {
        const maybeClient = this.connections.get(key);

        if (maybeClient) {
            console.debug("Proxying request", key);
            maybeClient.request(request, response);
        } else {
            console.debug("Rejecting request (no WebSocket)", key);

            // Send back an error.
            response
                .writeHead(502, "no WebSocket connection", {
                    "Content-Type": "application/json",
                })
                .end(
                    JSON.stringify({
                        jsonrpc: "2.0",
                        error: {
                            code: -32603,
                            message: "wtf: no WebSocket connection",
                        },
                        id: null,
                    })
                );
        }
    }

    public wsConnect(key: string, ws: WebSocket): void {
        ws.on("close", () => this.delete(key));
        ws.on("error", () => this.delete(key));

        const state = new ClientState(ws);
        const maybeClient = this.connections.get(key);

        if (maybeClient) {
            // Assume the existing connection is the "real" one.
            ws.close();
        } else {
            this.connections.set(key, state);
        }
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
