// Copyright © 2011-2022 OpenJS Foundation and contributors, https://openjsf.org
// Copyright © 2024 Binary Cake Ltd. & Contributors
//
import mocha from "mocha/mocha.js";

const EVENT_TEST_PASS = Mocha.Runner.constants.EVENT_TEST_PASS;
const EVENT_TEST_PENDING = Mocha.Runner.constants.EVENT_TEST_PENDING;
const EVENT_TEST_FAIL = Mocha.Runner.constants.EVENT_TEST_FAIL;
const EVENT_RUN_END = Mocha.Runner.constants.EVENT_RUN_END;
const STATE_FAILED = "failed";
const escape = Mocha.utils.escape;

function showDiff(err: unknown): err is { actual: string; expected: string } {
    if (!err || typeof err !== "object") {
        return false;
    }

    if ("showDiff" in err && err.showDiff === false) {
        return false;
    }

    if (!("actual" in err && "expected" in err)) {
        return false;
    }

    return typeof err.actual === "string" && typeof err.expected === "string";
}

export abstract class HtmlXUnit extends Mocha.reporters.HTML {
    private _report: string = "";

    constructor(runner: Mocha.Runner, options: Mocha.MochaOptions) {
        super(runner, options);

        // TODO: Figure out what's wrong with my typescript bindings that makes
        //       importing mocha without using it necessary.
        void mocha.setup;

        const stats = this.stats;
        const tests: Mocha.Test[] = [];

        // the name of the test suite, as it will appear in the resulting XML file
        const suiteName = "Wallet Test Framework";

        runner.on(EVENT_TEST_PENDING, (test: Mocha.Test) => {
            tests.push(test);
        });

        runner.on(EVENT_TEST_PASS, (test: Mocha.Test) => {
            tests.push(test);
        });

        runner.on(EVENT_TEST_FAIL, (test: Mocha.Test) => {
            tests.push(test);
        });

        runner.once(EVENT_RUN_END, () => {
            const skipped = (
                stats.tests -
                stats.failures -
                stats.passes
            ).toString();
            const data = {
                name: suiteName,
                tests: stats.tests.toString(),
                failures: "0",
                errors: stats.failures.toString(),
                skipped,
                timestamp: new Date().toUTCString(),
                time: "0",
            };
            if (typeof stats.duration !== "undefined") {
                data.time = (stats.duration / 1000).toString();
            }
            this.write(this.tag("testsuite", data, false));

            tests.forEach((t) => {
                this.test(t);
            });

            this.write("</testsuite>");
            this.report(this._report);
            this._report = "";
        });
    }

    protected abstract report(report: string): void;

    done(failures: number, fn?: (failures: number) => void): void {
        if (fn) {
            fn(failures);
        }
    }

    private write(line: string) {
        this._report += line + "\n";
    }

    private test(test: Mocha.Test) {
        const attrs = {
            classname: test.parent?.fullTitle() || "",
            name: test.title,
            time: ((test?.duration || 0) / 1000).toString(),
        };

        if (test.state === STATE_FAILED) {
            const generateDiff = Mocha.reporters.Base.generateDiff;
            const err = test.err || {};
            const diff = showDiff(err)
                ? "\n" + generateDiff(err.actual, err.expected)
                : "";
            const message = "message" in err ? err.message : "";
            const stack = "stack" in err ? err.stack : "";
            this.write(
                this.tag(
                    "testcase",
                    attrs,
                    false,
                    this.tag(
                        "failure",
                        {},
                        false,
                        escape(message) + escape(diff) + "\n" + escape(stack),
                    ),
                ),
            );
        } else if (test.isPending()) {
            this.write(
                this.tag(
                    "testcase",
                    attrs,
                    false,
                    this.tag("skipped", {}, true),
                ),
            );
        } else {
            this.write(this.tag("testcase", attrs, true));
        }
    }

    private tag(
        name: string,
        attrs: { [_: string]: string },
        close: boolean,
        content?: string,
    ) {
        const end = close ? "/>" : ">";
        const pairs = [];
        let tag;

        for (const key in attrs) {
            if (Object.prototype.hasOwnProperty.call(attrs, key)) {
                pairs.push(key + '="' + escape(attrs[key]) + '"');
            }
        }

        tag = "<" + name + (pairs.length ? " " + pairs.join(" ") : "") + end;
        if (content) {
            tag += content + "</" + name + end;
        }
        return tag;
    }
}
