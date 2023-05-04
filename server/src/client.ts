import { LRUCache } from "lru-cache";
import http from "node:http";
import { RawData, WebSocket } from "ws";

export class ClientState {
    private readonly inFlight: LRUCache<number, http.ServerResponse | false>;
    private requestCount = 0;

    public readonly connection: WebSocket;

    constructor(connection_: WebSocket) {
        this.inFlight = new LRUCache({
            max: 16,
            dispose: (value, key) => this.disposeInFlight(value, key),
        });
        this.connection = connection_;
        this.connection.on("message", (data) => this.onMessage(data));
    }

    private onMessage(data: RawData): void {
        let key: unknown;
        let result: unknown;
        let parsed: unknown;

        try {
            parsed = JSON.parse(data.toString());
        } catch (err) {
            console.debug("Invalid WebSocket message", err);
        }

        if (typeof parsed === "object" && parsed) {
            key = "number" in parsed ? parsed.number : undefined;
            result = "result" in parsed ? parsed.result : undefined;
        }

        if (typeof key !== "number" || typeof result !== "object") {
            this.connection.close(400);
            // TODO: Close connections in inFlight.
            return;
        }

        const res = this.inFlight.get(key);
        if (!res) {
            console.debug("Unexpected response");
            return;
        }

        // See: https://github.com/isaacs/node-lru-cache/issues/291
        this.inFlight.set(key, false, { noDisposeOnSet: true });
        this.inFlight.delete(key);

        console.debug("Proxying response", key);
        res.writeHead(200).end(JSON.stringify(result));
    }

    private disposeInFlight(
        value: http.ServerResponse | false,
        key: number
    ): void {
        if (!value) {
            return;
        }

        console.debug("Evicting request", key);

        // Send back an error.
        value
            .writeHead(504, "too many in-flight requests", {
                "Content-Type": "application/json",
            })
            .end(
                JSON.stringify({
                    jsonrpc: "2.0",
                    error: {
                        code: -32603,
                        message: "wtf: too many in-flight requests",
                    },
                    id: null,
                })
            );
    }

    public request(request: Buffer, res: http.ServerResponse): void {
        const requestId = this.requestCount++;
        this.inFlight.set(requestId, res);

        let body: unknown;

        try {
            body = JSON.parse(request.toString());
        } catch (e) {
            console.debug("Invalid JSON-RPC request", requestId);
            this.inFlight.delete(requestId);
            res.writeHead(400).end();
            return;
        }

        // Send the request to the WebSocket.
        this.connection.send(
            JSON.stringify({
                number: requestId,
                body,
            })
        );
    }

    public dispose(): void {
        this.connection.close(504);
        this.inFlight.clear();
    }
}
