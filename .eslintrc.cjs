module.exports = {
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "prettier",
    ],
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    root: true,
    parserOptions: {
        project: true,
    },

    overrides: [
        {
            files: ["**/Build.js"],
            rules: {
                "@typescript-eslint/no-unsafe-argument": ["off"],
                "@typescript-eslint/no-unsafe-assignment": ["off"],
                "@typescript-eslint/no-unsafe-call": ["off"],
                "@typescript-eslint/no-unsafe-member-access": ["off"],
            },
        },
        {
            files: ["client/src/tests/**/*.ts"],
            rules: {
                // ethers.js contracts use `any`... a lot.
                "@typescript-eslint/no-unsafe-argument": ["off"],
                "@typescript-eslint/no-unsafe-assignment": ["off"],
                "@typescript-eslint/no-unsafe-call": ["off"],
                "@typescript-eslint/no-unsafe-member-access": ["off"],
            },
        },
        {
            files: ["**/*.d.ts"],
            rules: {
                "@typescript-eslint/no-explicit-any": ["off"],
            },
        },
    ],
};
