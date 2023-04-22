import { delay } from "./util";
import {
    ActivateChain,
    Glue,
    RequestAccounts,
    RequestAccountsEvent,
} from "@wallet-test-framework/glue";
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

        element.style.display = "initial";

        this.attachEvents();
    }

    private emitRequestAccounts(data: Map<string, FormDataEntryValue>) {
        const accountsText = data.get("accounts");
        if (typeof accountsText !== "string") {
            throw "accounts wasn't a string";
        }

        const domain = data.get("domain");
        if (typeof domain !== "string") {
            throw "domain wasn't a string";
        }

        const accounts = accountsText.split(/[^a-fA-Fx0-9]/);
        this.emit(
            "requestaccounts",
            new RequestAccountsEvent(domain, accounts)
        );
    }

    private attachEvents(): void {
        const dialogs = this.eventsElement.querySelectorAll("dialog");

        type Handlers = {
            [key: string]: (_: Map<string, FormDataEntryValue>) => void;
        };

        const handlers: Handlers = {
            "request-accounts": (d) => this.emitRequestAccounts(d),
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

                const data = new Map(new FormData(form));
                handler(data);
            });
        }

        for (const unused of Object.keys(handlers)) {
            console.warn("unused handler", unused);
        }
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

    private async addEthereumChain(action: ActivateChain): Promise<void> {
        // TODO: Display instructions to approve these two actions in the wallet.
        await this.wallet.send("wallet_addEthereumChain", [
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
                    if (e.error instanceof Object && "code" in e.error) {
                        if (e.error.code === 4902) {
                            await delay(1000);
                            continue;
                        }
                    }
                }

                throw e;
            }
        } while (!switched);
    }

    override async activateChain(action: ActivateChain): Promise<void> {
        try {
            await this.addEthereumChain(action);
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
