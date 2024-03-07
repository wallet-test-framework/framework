interface BrowserMocha {
    throwError(err: any): never;
    setup(opts?: Mocha.Interface | Mocha.MochaOptions): this;
}

declare namespace Mocha {
    namespace utils {
        function escape(value?: unknown): string;
    }
}

declare module "mocha/mocha.js" {
    import Mocha from "mocha";
    const _: Mocha & BrowserMocha;
    export default _;
}
