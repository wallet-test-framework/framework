import { typecheckPlugin } from "@jgoz/esbuild-plugin-typecheck";
import * as esbuild from "esbuild";
import process from "node:process";
import { URL, fileURLToPath, pathToFileURL } from "node:url";

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
    minify: true,
    sourcemap: true,
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await esbuild.build(options);
}

export { options as default };
