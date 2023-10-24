#!/usr/bin/env node
import { Connections } from "./connections.js";
import cors from "cors";
import express from "express";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import getRawBody from "raw-body";
import serveStatic from "serve-static";
import { WebSocketServer } from "ws";

const app = express();

const WEB_ROOT = fileURLToPath(new URL("../client", import.meta.url));

const connections = new Connections();

app.use(cors());
app.use(serveStatic(WEB_ROOT));

function rpcRoute(req: express.Request, res: express.Response): void {
    const key = req.params["key"];

    console.debug("Received HTTP request", key, req.method);

    getRawBody(
        req,
        { length: req.headers["content-length"], limit: 2 * 1024 * 1024 },
        (err, body) => {
            if (err) {
                console.debug("Reading HTTP body failed", err);
                res.writeHead(err.statusCode).end(err.message);
                return;
            }

            connections.rpcRequest(key, body, res);
        },
    );
}

app.post("/rpc/:key", rpcRoute);
app.get("/rpc/:key", rpcRoute);

// Create server
const PORT = "PORT" in process.env ? parseInt(process.env.PORT || "") : 3000;
const server = app.listen(PORT, () => {
    console.info(`Listening on ${PORT}...`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
    console.info(
        "Incoming WebSocket",
        req.url,
        req.socket.remoteAddress,
        req.socket.remotePort,
    );

    const url = req.url;

    if (!url) {
        ws.close();
        return;
    }

    connections.wsConnect(url.slice(1), ws);
});

setInterval(() => {
    wss.clients.forEach((client) => {
        client.ping();
    });
}, 10000);
