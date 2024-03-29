import { typecheckPlugin } from "@jgoz/esbuild-plugin-typecheck";
import * as esbuild from "esbuild";
import { readFile, readdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import process from "node:process";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import solc from "solc";

const options = {
    plugins: [typecheckPlugin()],

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
    minify: false,
    sourcemap: true,
};

async function buildSolidity() {
    const contracts = fileURLToPath(new URL("./contracts", import.meta.url));

    const ls = await readdir(contracts, { withFileTypes: true });

    const sources = {};

    for (const source of ls) {
        if (!source.isFile()) {
            continue;
        }
        const sourcePath = path.join(contracts, source.name);

        sources[source.name] = {
            content: await readFile(sourcePath, "utf8"),
        };
    }

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
            }),
        ),
    );

    for (const file of Object.keys(output.contracts)) {
        const outfile = fileURLToPath(
            new URL(`./src/contracts/${file}.ts`, import.meta.url),
        );

        let content = ["/* THIS FILE IS AUTOGENERATED */"];

        for (const contract of Object.keys(output.contracts[file])) {
            const bytecode =
                output.contracts[file][contract].evm.bytecode.object;
            if (typeof bytecode !== "string") {
                throw "not a string";
            }

            const prefix = contract.toUpperCase();
            content.push(
                `export const ${prefix}_ABI = ${JSON.stringify(
                    output.contracts[file][contract].abi,
                )} as const;`,
            );
            content.push(
                `export const ${prefix}_BYTECODE = ${JSON.stringify(
                    "0x" + bytecode,
                )};`,
            );
        }

        await writeFile(outfile, content);
    }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await buildSolidity().then(async () => await esbuild.build(options));
}

export { options as default };
