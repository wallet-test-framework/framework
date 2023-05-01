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
