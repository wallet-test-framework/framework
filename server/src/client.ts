import http from "node:http";
import { RawData, WebSocket } from "ws";

export class ClientState {
    // TODO: Replace this Map with an LRUCache
    readonly inFlight: Map<number, http.ServerResponse>;

    requestCount = 0;

    public maxInFlight = 25;
    public readonly connection: WebSocket;

    constructor(connection_: WebSocket) {
        this.inFlight = new Map();
        this.connection = connection_;
        this.connection.on("message", (data) => this.onMessage(data));
    }

    private onMessage(data: RawData): void {
        let number: unknown;
        let result: unknown;

        try {
            const parsed = JSON.parse(data.toString());
            number = parsed.number;
            result = parsed.result;
        } catch (err) {
            console.debug("Invalid WebSocket message", err);
        }

        if (typeof number !== "number" || typeof result !== "object") {
            this.connection.close(400);
            // TODO: Close connections in inFlight.
            return;
        }

        const res = this.inFlight.get(number);
        if (!res) {
            console.debug("Unexpected response");
            return;
        }

        this.inFlight.delete(number);

        res.writeHead(200).end(JSON.stringify(result));
    }

    private evict(): [number, http.ServerResponse] {
        // Get oldest entry in `inFlight`.
        const [[key, value]] = this.inFlight;

        console.debug("Evicting request", key);

        // Remove it from the map.
        this.inFlight.delete(key);

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

        return [key, value];
    }

    public request(request: Buffer, res: http.ServerResponse): void {
        const requestId = this.requestCount++;
        this.inFlight.set(requestId, res);

        // Make sure we don't have too many requests in flight.
        if (this.inFlight.size > this.maxInFlight) {
            const [evicted] = this.evict();
            if (evicted === requestId) {
                // We evicted the request we just added, so there's no point in
                // continuing.
                return;
            }
        }

        let body;

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
        while (this.inFlight.size > 0) {
            this.evict();
        }
        this.connection.close(504);
    }
}
