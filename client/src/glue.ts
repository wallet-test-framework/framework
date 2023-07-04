import { AnyChain } from "./index";
import { delay } from "./util";
import {
    ActivateChain,
    AddEthereumChain,
    AddEthereumChainEvent,
    EventMap,
    Glue,
    RequestAccounts,
    RequestAccountsEvent,
    SignMessage,
    SignMessageEvent,
    SwitchEthereumChain,
    SwitchEthereumChainEvent,
} from "@wallet-test-framework/glue";
import assert from "assert";
import { Client as WebSocketClient } from "rpc-websockets";

type Events = { [k in keyof EventMap]: null };

const EVENTS: (keyof Events)[] = (() => {
    const helper: Events = {
        requestaccounts: null,
        addethereumchain: null,
        switchethereumchain: null,
        signmessage: null,
    } as const;

    const events: (keyof Events)[] = [];

    let key: keyof Events;
    for (key in helper) {
        events.push(key);
    }

    return events;
})();

type TemplateContext = { [key: string]: string | HTMLElement };

abstract class Template extends HTMLElement {
    public static define(
        templateName: string
    ): (new (_: TemplateContext) => Template) & typeof Template {
        const clazz = class extends Template {
            constructor(values: TemplateContext) {
                super(values);

                const template = document.getElementById(templateName);
                if (!template) {
                    throw `missing #${templateName} element`;
                }

                if (!("content" in template)) {
                    throw `element #${templateName} not a template`;
                }

                if (!(template.content instanceof DocumentFragment)) {
                    throw `element #${templateName} not a template`;
                }

                const shadowRoot = this.attachShadow({ mode: "open" });
                shadowRoot.appendChild(template.content.cloneNode(true));
            }
        };
        customElements.define(templateName, clazz);
        return clazz;
    }

    constructor(values: TemplateContext) {
        super();

        for (const [key, value] of Object.entries(values)) {
            if (value instanceof HTMLElement) {
                value.slot = key;
                this.appendChild(value);
            } else {
                const span = document.createElement("span");
                span.slot = key;
                span.innerText = value;
                this.appendChild(span);
            }
        }
    }
}

const ActivateChainTemplate = Template.define("wtf-activate-chain");
const InstructTemplate = Template.define("wtf-instruct");
const RequestAccountsTemplate = Template.define("wtf-request-accounts");
const SignMessageTemplate = Template.define("wtf-sign-message");
const AddEthereumChainTemplate = Template.define("wtf-add-ethereum-chain");
const SwitchEthereumChainTemplate = Template.define(
    "wtf-switch-ethereum-chain"
);

export class ManualGlue extends Glue {
    private readonly rootElement: HTMLElement;
    private readonly eventsElement: HTMLElement;
    private readonly instructionsElement: HTMLElement;

    private readonly wallet: AnyChain;

    constructor(element: HTMLElement, wallet: AnyChain) {
        super();

        this.wallet = wallet;
        this.rootElement = element;

        const events = element.getElementsByClassName("events")[0];
        const instructions = element.getElementsByClassName("instructions")[0];

        if (!(events instanceof HTMLElement)) {
            throw "missing .events element";
        }

        if (!(instructions instanceof HTMLElement)) {
            throw "missing .instructions element";
        }

        this.eventsElement = events;
        this.instructionsElement = instructions;

        element.classList.add("glue-active");

        this.attachEvents();
    }

    private static splitArray(input?: string): undefined | string[] {
        if (!input) {
            return;
        }

        input = input.trim();

        if (!input.length) {
            return;
        }

        return input.split(/[\s]+/);
    }

    private emitSwitchEthereumChain(data: Map<string, string>) {
        const domain = data.get("domain");
        const chainId = data.get("chain-id");

        if (!domain || !chainId) {
            throw "incomplete switch-ethereum-chain";
        }

        this.emit(
            "switchethereumchain",
            new SwitchEthereumChainEvent(domain, {
                chainId,
            })
        );
    }

    private emitAddEthereumChain(data: Map<string, string>) {
        const domain = data.get("domain");
        const chainId = data.get("chain-id");
        let chainName = data.get("chain-name");
        const blockExplorerUrls = ManualGlue.splitArray(
            data.get("block-explorer-urls")
        );
        const iconUrls = ManualGlue.splitArray(data.get("icon-urls"));
        const rpcUrls = ManualGlue.splitArray(data.get("rpc-urls"));

        // TODO: nativeCurrency

        if (!domain || !chainId) {
            throw "incomplete add-ethereum-chain";
        }

        if (chainName?.trim() === "") {
            chainName = undefined;
        }

        this.emit(
            "addethereumchain",
            new AddEthereumChainEvent(domain, {
                chainId,
                chainName,
                blockExplorerUrls,
                iconUrls,
                rpcUrls,
            })
        );
    }

    private emitRequestAccounts(data: Map<string, string>) {
        const accountsText = data.get("accounts");
        if (typeof accountsText !== "string") {
            throw "form missing accounts";
        }

        const domain = data.get("domain");
        if (typeof domain !== "string") {
            throw "form missing domain";
        }

        const accounts = accountsText.split(/[^a-fA-Fx0-9]/);
        this.emit(
            "requestaccounts",
            new RequestAccountsEvent(domain, { accounts })
        );
    }

    private emitSignMessage(data: Map<string, string>) {
        const message = data.get("message");
        if (typeof message !== "string") {
            throw "form missing message";
        }

        const domain = data.get("domain");
        if (typeof domain !== "string") {
            throw "form missing domain";
        }

        this.emit("signmessage", new SignMessageEvent(domain, { message }));
    }

    private attachEvents(): void {
        const dialogs = this.eventsElement.querySelectorAll("dialog");

        type Handlers = {
            [key: string]: (_: Map<string, string>) => void;
        };

        const handlers: Handlers = {
            "request-accounts": (d) => this.emitRequestAccounts(d),
            "sign-message": (d) => this.emitSignMessage(d),
            "add-ethereum-chain": (d) => this.emitAddEthereumChain(d),
            "switch-ethereum-chain": (d) => this.emitSwitchEthereumChain(d),
        };

        for (const dialog of dialogs) {
            if (!(dialog instanceof HTMLDialogElement)) {
                console.warn("element isn't a dialog", dialog);
                continue;
            }

            if (!(dialog.parentNode instanceof HTMLElement)) {
                console.warn("dialog parent isn't an HTMLElement", dialog);
                continue;
            }

            const button = dialog.parentNode?.querySelector("button");
            if (!(button instanceof HTMLElement)) {
                console.warn("dialog has no button", dialog);
                continue;
            }

            const form = dialog.querySelector("form");
            if (!(form instanceof HTMLFormElement)) {
                console.warn("dialog has no form", dialog);
                continue;
            }

            const handlerId = dialog.dataset.event;
            if (!handlerId || !(handlerId in handlers)) {
                console.warn("dialog has no matching handler", dialog);
                continue;
            }

            const handler = handlers[handlerId];
            delete handlers[handlerId];

            button.addEventListener("click", () => {
                form.reset();
                dialog.showModal();
            });

            form.addEventListener("submit", (e) => {
                if (e.submitter && "value" in e.submitter) {
                    if (e.submitter.value === "cancel") {
                        return;
                    }
                }

                const rawData = new FormData(form);
                const data = new Map<string, string>();
                for (const [key, value] of rawData) {
                    if (typeof value === "string") {
                        data.set(key, value);
                    } else {
                        throw `form field ${key} has non-string type`;
                    }
                }
                handler(data);
            });
        }

        for (const unused of Object.keys(handlers)) {
            console.warn("unused handler", unused);
        }
    }

    override async switchEthereumChain(
        action: SwitchEthereumChain
    ): Promise<void> {
        if (action.action !== "approve") {
            throw "not implemented";
        }

        await this.instruct(
            new SwitchEthereumChainTemplate({
                id: action.id,
            })
        );
    }

    override async addEthereumChain(action: AddEthereumChain): Promise<void> {
        if (action.action !== "approve") {
            throw "not implemented";
        }

        await this.instruct(
            new AddEthereumChainTemplate({
                id: action.id,
            })
        );
    }

    override async requestAccounts(action: RequestAccounts): Promise<void> {
        if (action.action !== "approve") {
            throw "not implemented";
        }

        const list = document.createElement("ul");
        for (const account of action.accounts) {
            const elem = document.createElement("li");
            elem.innerText = account;
            list.appendChild(elem);
        }

        await this.instruct(
            new RequestAccountsTemplate({
                id: action.id,
                accounts: list,
            })
        );
    }

    override async signMessage(action: SignMessage): Promise<void> {
        if (action.action !== "approve") {
            throw "not implemented";
        }

        await this.instruct(
            new SignMessageTemplate({
                id: action.id,
            })
        );
    }

    private async tryAddEthereumChain(action: ActivateChain): Promise<void> {
        // MetaMask (and possibly others) display a switch chain prompt before
        // returning from `wallet_addEthereumChain`. To catch that prompt, we
        // have to listen to the switch event before even adding the chain.
        let switchActionPromise: unknown = null;
        const switchUnsubscribe = this.on("switchethereumchain", (ev) => {
            switchUnsubscribe();
            assert.strictEqual(
                Number.parseInt(ev.chainId),
                Number.parseInt(action.chainId),
                `expected to switch to chain ${action.chainId},` +
                    ` but got ${ev.chainId}`
            );

            switchActionPromise = this.switchEthereumChain({
                id: ev.id,
                action: "approve",
            });
        });

        try {
            const addPromise = this.wallet.wallet.addChain({
                chain: {
                    id: Number.parseInt(action.chainId),
                    name: `Test Chain ${action.chainId}`,
                    network: "test-chain",
                    nativeCurrency: {
                        name: "teth",
                        symbol: "teth",
                        decimals: 18,
                    },
                    rpcUrls: {
                        default: { http: [action.rpcUrl] },
                        public: { http: [action.rpcUrl] },
                    },
                },
            });

            const addEvent = await this.next("addethereumchain");

            assert.strictEqual(
                addEvent.rpcUrls.length,
                1,
                `expected one RPC URL, but got ${addEvent.rpcUrls.length}`
            );

            assert.strictEqual(
                addEvent.rpcUrls[0],
                action.rpcUrl,
                `expected an RPC URL of "${action.rpcUrl}",` +
                    ` but got "${addEvent.rpcUrls[0]}"`
            );

            assert.strictEqual(
                Number.parseInt(addEvent.chainId),
                Number.parseInt(action.chainId),
                `expected a chain id of ${action.chainId},` +
                    ` but got ${addEvent.chainId}`
            );

            await this.addEthereumChain({
                id: addEvent.id,
                action: "approve",
            });

            await addPromise;

            const switchPromise = (async () => {
                let switched = false;
                do {
                    try {
                        await this.wallet.wallet.switchChain({
                            id: Number.parseInt(action.chainId),
                        });
                        switched = true;
                    } catch (e: unknown) {
                        if (e instanceof Error && "error" in e) {
                            if (
                                e.error instanceof Object &&
                                "code" in e.error
                            ) {
                                if (e.error.code === 4902) {
                                    await delay(1000);
                                    continue;
                                }
                            }
                        }

                        throw e;
                    }
                } while (!switched);
            })();

            await switchPromise;
            if (switchActionPromise instanceof Promise) {
                await switchActionPromise;
            }
        } finally {
            switchUnsubscribe();
        }
    }

    override async activateChain(action: ActivateChain): Promise<void> {
        try {
            await this.tryAddEthereumChain(action);
            return;
        } catch (e: unknown) {
            // wallet_addEthereumChain isn't exactly the safest endpoint, so we
            // don't expect wallets to implement it. We try optimistically but
            // fall back to human instructions if necessary.
            console.debug("`wallet_addEthereumChain` failed, going manual", e);
        }

        await this.instruct(
            new ActivateChainTemplate({
                "chain-id": action.chainId,
                "rpc-url": action.rpcUrl,
            })
        );
    }

    private async instruct(template: Template): Promise<void> {
        if (this.instructionsElement.children.length) {
            throw "previous instruction not completed";
        }

        await new Promise<void>((res, rej) => {
            const abort = document.createElement("button");
            abort.innerText = "Abort";
            abort.addEventListener("click", () => {
                this.instructionsElement.replaceChildren();
                rej();
            });

            const complete = document.createElement("button");
            complete.innerText = "Complete";
            complete.addEventListener("click", () => {
                this.instructionsElement.replaceChildren();
                res();
            });

            const instruct = new InstructTemplate({
                content: template,
                abort,
                complete,
            });

            this.instructionsElement.replaceChildren(instruct);
        });
    }
}

export class WebSocketGlue extends Glue {
    private readonly client: WebSocketClient;

    public static async connect(address: string): Promise<WebSocketGlue> {
        const self = new WebSocketGlue(address);

        const open = new Promise((res, rej) => {
            try {
                self.client.once("open", res);
            } catch (e: unknown) {
                rej(e);
            }
        });

        self.client.connect();

        await open;

        for (const key of EVENTS) {
            self.client.on(key, (evt) => self.handle(key, evt));
            await self.client.subscribe(key);
        }

        return self;
    }

    private constructor(address: string) {
        super();
        this.client = new WebSocketClient(address);
    }

    private handle(key: keyof EventMap, evt: unknown): void {
        if (!evt || typeof evt !== "object") {
            throw new TypeError("Event argument not object");
        }

        // TODO: Validate the event object is correct.

        /* eslint-disable-next-line @typescript-eslint/no-unsafe-argument,
                                    @typescript-eslint/no-explicit-any */
        this.emit(key, evt as any);
    }

    async activateChain(action: ActivateChain): Promise<void> {
        await this.client.call("activateChain", [action]);
    }

    async requestAccounts(action: RequestAccounts): Promise<void> {
        await this.client.call("requestAccounts", [action]);
    }

    async switchEthereumChain(action: SwitchEthereumChain): Promise<void> {
        await this.client.call("switchEthereumChain", [action]);
    }

    async addEthereumChain(action: AddEthereumChain): Promise<void> {
        await this.client.call("addEthereumChain", [action]);
    }

    async signMessage(action: SignMessage): Promise<void> {
        await this.client.call("signMessage", [action]);
    }
}
