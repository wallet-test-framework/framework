import Ganache, { EthereumProvider } from "ganache";

debugger; // eslint-disable-line no-debugger

function onConfigure(evt: MessageEvent): void {
    removeEventListener("message", onConfigure);

    // Without doing runtime type checking, it's impossible to ensure the
    // message data conforms to the options type from ganache.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const ganache = Ganache.provider(evt.data);
    addEventListener("message", (evt) => onMessage(ganache, evt));
}

function onMessage(ganache: EthereumProvider, evt: MessageEvent): void {
    const reply = evt.ports[0];
    ganache
        // Without doing runtime type checking, it's impossible to ensure the
        // message data conforms to the JSON RPC spec.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .request(evt.data)
        .then((result) => reply.postMessage({ result }))
        .catch((error) => {
            console.error("Uncaught (in ganache worker thread)", error);
            reply.postMessage({
                error: {
                    message: String(error),
                    code: -32000,
                },
            });
        });
}

addEventListener("message", onConfigure);
