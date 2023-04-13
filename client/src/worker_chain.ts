import Ganache, { EthereumProvider } from "ganache";

function onConfigure(evt: MessageEvent): void {
    removeEventListener("message", onConfigure);

    const ganache = Ganache.provider(evt.data);
    addEventListener("message", (evt) => onMessage(ganache, evt));
}

async function onMessage(
    ganache: EthereumProvider,
    evt: MessageEvent
): Promise<void> {
    const reply = evt.ports[0];
    reply.postMessage(await ganache.request(evt.data));
}

addEventListener("message", onConfigure);
