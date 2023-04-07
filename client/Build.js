import { typecheckPlugin } from "@jgoz/esbuild-plugin-typecheck";
import * as esbuild from "esbuild";
import { copyFile } from "node:fs/promises";
import process from "node:process";
import { URL, fileURLToPath, pathToFileURL } from "node:url";

const options = {
    plugins: [typecheckPlugin()],

    absWorkingDir: fileURLToPath(new URL(".", import.meta.url)),

    entryPoints: ["src/index.ts", "src/worker_chain.ts"],

    inject: ["src/shim-process.js"],

    bundle: true,
    outbase: "src",
    outdir: "../dist/client/",
    target: "es2020",
    platform: "browser",
    minify: true,
    sourcemap: true,
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await esbuild.build(options);

    await copyFile(
        new URL("./src/index.html", import.meta.url),
        new URL("../dist/client/index.html", import.meta.url)
    );
}

export { options as default };
