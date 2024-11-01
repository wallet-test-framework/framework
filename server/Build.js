import { typecheckPlugin } from "@jgoz/esbuild-plugin-typecheck";
import * as esbuild from "esbuild";
import process from "node:process";
import { URL, fileURLToPath, pathToFileURL } from "node:url";

const options = {
    plugins: [typecheckPlugin()],

    absWorkingDir: fileURLToPath(new URL(".", import.meta.url)),

    entryPoints: ["src/index.ts", "src/client.ts", "src/connections.ts"],

    outbase: "src",
    outdir: "../dist/server/",
    target: "es2020",
    format: "esm",
    platform: "node",
    minify: true,
    sourcemap: true,
    keepNames: true
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await esbuild.build(options);
}

export { options as default };
