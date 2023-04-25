import { typecheckPlugin } from "@jgoz/esbuild-plugin-typecheck";
import * as esbuild from "esbuild";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import solc from "solc";

const solcPlugin = {
    name: "solc",
    setup(build) {
        build.onLoad({ filter: /\.sol$/ }, async (args) => {
            const sources = {};
            sources[args.path] = {
                content: await readFile(args.path, "utf8"),
            };

            const output = JSON.parse(
                solc.compile(
                    JSON.stringify({
                        language: "Solidity",
                        sources,
                        settings: {
                            outputSelection: {
                                "*": {
                                    "*": ["abi", "evm.bytecode.object"],
                                },
                            },
                        },
                    })
                )
            );

            const errors = [];
            const warnings = [];
            if (output.errors?.length > 0) {
                for (const error of output.errors) {
                    const obj = {
                        text: error.message,
                        detail: error,
                        location: {
                            file: error?.sourceLocation?.file,
                        },
                    };

                    if (error.severity === "warning") {
                        warnings.push(obj);
                    } else {
                        errors.push(obj);
                    }
                }
            }

            const built = {
                loader: "json",
                errors,
                warnings,
            };

            if (output.contracts) {
                built.contents = JSON.stringify(output.contracts[args.path]);
            }

            return built;
        });
    },
};

const options = {
    plugins: [typecheckPlugin(), solcPlugin],

    absWorkingDir: fileURLToPath(new URL(".", import.meta.url)),

    entryPoints: ["src/index.ts", "src/worker_chain.ts", "src/index.html"],

    inject: ["src/shim-process.js"],

    loader: { ".html": "copy" },

    bundle: true,
    outbase: "src",
    outdir: "../dist/client/",
    target: "es2020",
    format: "esm",
    platform: "browser",
    minify: true,
    sourcemap: true,
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await esbuild.build(options);
}

export { options as default };
