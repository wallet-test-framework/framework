export function delay(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
}

export interface RetryOptions<F> {
    operation: F;

    /**
     * Maximum time to retry the operation.
     */
    totalMillis?: number;

    /**
     * Time to wait after each attempt.
     */
    delayMillis?: number;
}

export class Timeout extends Error {}

export async function retry<F extends (...args: unknown[]) => Promise<R>, R>(
    func: F | RetryOptions<F>,
    ...args: Parameters<F>
): Promise<R> {
    let options: RetryOptions<F>;

    if (typeof func === "function") {
        options = { operation: func };
    } else {
        options = func;
    }

    const { totalMillis = 30000, delayMillis = 1000 } = options;

    const deadline = Date.now() + totalMillis;

    const timeout = (async () => {
        // Give some extra time for the runner, so it has time to throw a more
        // useful error.
        await delay(totalMillis * 1.05);
        throw new Timeout();
    })();

    let lastCaught: null | { caught: unknown } = null;
    const runner = async () => {
        while (Date.now() < deadline) {
            try {
                return await options.operation(...args);
            } catch (caught: unknown) {
                lastCaught = { caught };
            }

            const wait = Math.min(deadline - Date.now(), delayMillis);
            if (wait > 0) {
                await delay(wait);
            }
        }

        if (lastCaught === null) {
            throw new Timeout();
        } else {
            throw lastCaught.caught;
        }
    };

    return await Promise.race([timeout, runner()]);
}

export function notEver(promise: Promise<unknown>): Promise<void> {
    const throwingPromise = promise.then(() => {
        throw new Error("Promise resolved, but it shouldn't have");
    });

    const delayPromise = delay(30 * 1000);

    return Promise.race([throwingPromise, delayPromise]);
}

export function spawn<R, T extends Array<U>, U>(
    f: (...args: T) => Promise<R>
): (...args: Parameters<typeof f>) => void {
    // Create an error here so we can display a backtrace at runtime if
    // something gets thrown (at least in browsers that support backtraces.)
    const origin = new Error("spawned here");

    return (...args: Parameters<typeof f>): void => {
        f(...args).catch((error) => {
            console.error(error, "\n", origin);
            alert(
                "an unhandled exception has occurred; please check the console"
            );
        });
    };
}
