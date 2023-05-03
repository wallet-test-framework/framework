import { delay } from "./util";
import {
    ActivateChain,
    AddEthereumChain,
    AddEthereumChainEvent,
    Glue,
    RequestAccounts,
    RequestAccountsEvent,
    SwitchEthereumChain,
    SwitchEthereumChainEvent,
} from "@wallet-test-framework/glue";
import assert from "assert";
import { ethers } from "ethers";

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
const AddEthereumChainTemplate = Template.define("wtf-add-ethereum-chain");
const SwitchEthereumChainTemplate = Template.define(
    "wtf-switch-ethereum-chain"
);

export class ManualGlue extends Glue {
    private readonly rootElement: HTMLElement;
    private readonly eventsElement: HTMLElement;
    private readonly instructionsElement: HTMLElement;

    private readonly wallet: ethers.JsonRpcApiProvider;

    constructor(element: HTMLElement, wallet: ethers.JsonRpcApiProvider) {
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

    private attachEvents(): void {
        const dialogs = this.eventsElement.querySelectorAll("dialog");

        type Handlers = {
            [key: string]: (_: Map<string, string>) => void;
        };

        const handlers: Handlers = {
            "request-accounts": (d) => this.emitRequestAccounts(d),
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
                const data = new Map();
                for (const [key, value] of rawData) {
                    if (typeof value === "string") {
                        data.set(key, value);
                    } else {
                        throw `form field ${key} has non-string value ${value}`;
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

    private async tryAddEthereumChain(action: ActivateChain): Promise<void> {
        // MetaMask (and possibly others) display a switch chain prompt before
        // returning from `wallet_addEthereumChain`. To catch that prompt, we
        // have to listen to the switch event before even adding the chain.
        let switchActionPromise: Promise<unknown> | null = null;
        const switchUnsubscribe = this.on("switchethereumchain", async (ev) => {
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
            const addPromise = this.wallet.send("wallet_addEthereumChain", [
                {
                    chainId: action.chainId,
                    chainName: `Test Chain ${action.chainId}`,
                    nativeCurrency: {
                        name: "teth",
                        symbol: "teth",
                        decimals: 18,
                    },
                    rpcUrls: [action.rpcUrl],
                },
            ]);

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
                        await this.wallet.send("wallet_switchEthereumChain", [
                            {
                                chainId: action.chainId,
                            },
                        ]);
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
            if (switchActionPromise) {
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
            console.debug("`wallet_addEthereumChain` failed, going manual");
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
