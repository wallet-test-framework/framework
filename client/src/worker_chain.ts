import { Provider } from "@remix-project/remix-simulator";

function onConfigure(evt: MessageEvent): void {
    removeEventListener("message", onConfigure);

    // Without doing runtime type checking, it's impossible to ensure the
    // message data conforms to the options type from provider.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const provider = new Provider(evt.data);
    provider.init()
    addEventListener("message", (evt) => onMessage(provider, evt));
}

function onMessage(provider: Provider, evt: MessageEvent): void {
    const reply = evt.ports[0];
    let promise
    if (provider.initializing) {
        promise = new Promise<void>((res) => setTimeout(() => { res() }, 5000));
    } else {
        promise = new Promise<void>((res) => res());
    }
    promise
        .then(() =>
            provider
                // Without doing runtime type checking, it's impossible to ensure the
                // message data conforms to the JSON RPC spec.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                .request(evt.data),
        )
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        .then((result) => reply.postMessage({ result }))
        .catch((error) => {
            console.error("Uncaught (in provider worker thread)", error);
            reply.postMessage({
                error: {
                    message: String(error),
                    code: -32000,
                },
            });
        });
}

addEventListener("message", onConfigure);
