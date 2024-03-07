// Copyright © 2011-2022 OpenJS Foundation and contributors, https://openjsf.org
// Copyright © 2024 Binary Cake Ltd. & Contributors
//
import mocha from "mocha/mocha.js";
import { format as sprintf } from "util";

const EVENT_TEST_PASS = Mocha.Runner.constants.EVENT_TEST_PASS;
const EVENT_TEST_PENDING = Mocha.Runner.constants.EVENT_TEST_PENDING;
const EVENT_TEST_FAIL = Mocha.Runner.constants.EVENT_TEST_FAIL;
const EVENT_TEST_END = Mocha.Runner.constants.EVENT_TEST_END;
const EVENT_RUN_END = Mocha.Runner.constants.EVENT_RUN_END;
const EVENT_RUN_BEGIN = Mocha.Runner.constants.EVENT_RUN_BEGIN;

export class HtmlTap extends Mocha.reporters.HTML {
    private _producer: TapProducer;

    constructor(
        runner: Mocha.Runner,
        options?: Mocha.MochaOptions | undefined,
    ) {
        super(runner, options);

        // TODO: Figure out what's wrong with my typescript bindings that makes
        //       importing mocha without using it necessary.
        void mocha.setup;

        let n = 1;

        let tapVersion = "12";
        if (options && options.reporterOptions) {
            const reporterOptions: unknown = options.reporterOptions;
            if (reporterOptions && typeof reporterOptions === "object") {
                if (
                    "tapVersion" in reporterOptions &&
                    reporterOptions.tapVersion
                ) {
                    // eslint-disable-next-line @typescript-eslint/no-base-to-string
                    tapVersion = reporterOptions.tapVersion.toString();
                }
            }
        }

        this._producer = createProducer(Number.parseInt(tapVersion));

        runner.once(EVENT_RUN_BEGIN, () => {
            this._producer.writeVersion();
        });

        runner.on(EVENT_TEST_END, () => {
            ++n;
        });

        runner.on(EVENT_TEST_PENDING, (test) => {
            this._producer.writePending(n, test);
        });

        runner.on(EVENT_TEST_PASS, (test) => {
            this._producer.writePass(n, test);
        });

        runner.on(EVENT_TEST_FAIL, (test, err) => {
            this._producer.writeFail(n, test, err);
        });

        runner.once(EVENT_RUN_END, () => {
            if (runner.stats) {
                this._producer.writeEpilogue(runner.stats);
            }
        });
    }
}

function title(test: Mocha.Test) {
    return test.fullTitle().replace(/#/g, "");
}

function println(format: string, ...args: unknown[]) {
    format += "\n";
    console.log(sprintf(format, ...args));
}

function createProducer(tapVersion: number): TapProducer {
    const producers: { [key: number]: TapProducer } = {
        12: new Tap12Producer(),
        13: new Tap13Producer(),
    };
    const producer = producers[tapVersion];

    if (!producer) {
        throw new Error(
            "invalid or unsupported Tap version: " + JSON.stringify(tapVersion),
        );
    }

    return producer;
}

abstract class TapProducer {
    writeVersion(): void {}
    writePlan(ntests: number): void {
        println("%d..%d", 1, ntests);
    }
    writePass(n: number, test: Mocha.Test): void {
        println("ok %d %s", n, title(test));
    }
    writePending(n: number, test: Mocha.Test): void {
        println("ok %d %s # SKIP -", n, title(test));
    }
    writeFail(n: number, test: Mocha.Test, _err: unknown): void {
        println("not ok %d %s", n, title(test));
    }
    writeEpilogue(stats: Mocha.Stats): void {
        // :TBD: Why is this not counting pending tests?
        println("# tests " + (stats.passes + stats.failures));
        println("# pass " + stats.passes);
        // :TBD: Why are we not showing pending results?
        println("# fail " + stats.failures);
        this.writePlan(stats.passes + stats.failures + stats.pending);
    }
}

class Tap12Producer extends TapProducer {
    writeFail(n: number, test: Mocha.Test, err: unknown): void {
        super.writeFail(n, test, err);

        if (!err || typeof err !== "object") {
            return;
        }

        if ("message" in err && typeof err.message === "string") {
            println(err.message.replace(/^/gm, "  "));
        }
        if ("stack" in err && typeof err.stack === "string") {
            println(err.stack.replace(/^/gm, "  "));
        }
    }
}

class Tap13Producer extends TapProducer {
    writeVersion(): void {
        println("Tap version 13");
    }

    writeFail(n: number, test: Mocha.Test, err: unknown): void {
        super.writeFail(n, test, err);

        if (!err || typeof err !== "object") {
            return;
        }

        let message = null;
        if ("message" in err && typeof err.message === "string") {
            message = err.message.replace(/^/gm, this.indent(3));
        }

        let stack = null;
        if ("stack" in err && typeof err.stack === "string") {
            stack = err.stack.replace(/^/gm, this.indent(3));
        }

        if (!message && !stack) {
            return;
        }

        println(this.indent(1) + "---");
        if (message) {
            println(this.indent(2) + "message: |-");
            println(message);
        }
        if (stack) {
            println(this.indent(2) + "stack: |-");
            println(stack);
        }
        println(this.indent(1) + "...");
    }

    private indent(level: number): string {
        return Array(level + 1).join("  ");
    }
}
