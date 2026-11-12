/**
 * Deploy Poller with exponential backoff retry.
 *
 * Provides retry logic with exponential backoff for deployment polling.
 * Uses the p-retry library which is already a dependency.
 *
 * @param fn - Async function to retry
 * @param options - Retry options with backoff configuration
 * @returns Resolution of the function if retries succeed
 *
 * @example
 * ```typescript
 * const result = await pollWithBackoff(
 *   () => fetchDeploymentStatus(),
 *   { retries: 5, startingDelay: 1000 }
 * );
 * ```
 */
import pRetry from 'p-retry';

/**
 * Default backoff configuration
 */
const DEFAULT_STARTING_DELAY_MS = 1_000; // 1 second
const DEFAULT_MULTIPLIER = 2; // Exponential
const DEFAULT_MAX_ATTEMPTS = 10;

/**
 * Options for pollWithBackoff
 */
export interface PollWithBackoffOptions<T> {
  /** The async function to retry */
  fn: () => Promise<T>;
  /** Maximum number of retry attempts (default: 10) */
  maxAttempts?: number;
  /** Initial delay in ms between attempts (default: 1000) */
  startingDelay?: number;
  /** Backoff multiplier for exponential increase (default: 2) */
  multiplier?: number;
  /** Maximum delay in ms between attempts */
  maxDelay?: number;
  /** Callback called on each failed attempt */
  onFailedAttempt?: (error: Error, attempt: number) => void;
  /** Callback called when retry succeeds */
  onSuccess?: (result: T, attempt: number) => void;
}

/**
 * Result of a polling operation with backoff
 */
export interface PollWithBackoffResult<T> {
  /** The successful result */
  result: T;
  /** Number of attempts made (including the successful one) */
  attempts: number;
  /** Whether it succeeded within the retry limit */
  succeeded: boolean;
  /** The last error if all attempts failed */
  lastError?: Error;
}

/**
 * Poll an async function with exponential backoff retry.
 *
 * Uses p-retry under the hood to implement retry with configurable backoff.
 * On each failed attempt, waits for `startingDelay * multiplier^(attempt-1)` milliseconds
 * before the next retry.
 *
 * @param options - Configuration for the polling operation
 * @returns Result containing the successful value and metadata about attempts
 *
 * @example
 * ```typescript
 * // Poll with 3 retries, starting at 500ms, doubling each time
 * const result = await pollWithBackoff({
 *   fn: () => checkDeploymentStatus(),
 *   maxAttempts: 3,
 *   startingDelay: 500,
 *   multiplier: 2, // 500ms, 1000ms, 2000ms
 * });
 *
 * if (result.succeeded) {
 *   console.log('Deployment status checked successfully');
 * }
 * ```
 */
export async function pollWithBackoff<T>(
  options: PollWithBackoffOptions<T>
): Promise<PollWithBackoffResult<T>> {
  const {
    fn,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    startingDelay = DEFAULT_STARTING_DELAY_MS,
    multiplier = DEFAULT_MULTIPLIER,
    maxDelay,
    onFailedAttempt,
    onSuccess,
  } = options;

  let lastError: Error;

  const attemptOptions = {
    retries: maxAttempts - 1,
    onFailedAttempt: (error: any, currentAttempt: number) => {
      const attemptNumber = currentAttempt + 1; // Convert from 0-indexed to 1-indexed
      const delay = startingDelay * Math.pow(multiplier, attemptNumber - 1);

      // Apply maxDelay cap if specified
      const finalDelay = maxDelay ? Math.min(delay, maxDelay) : delay;

      lastError = error instanceof Error ? error : new Error(String(error));

      onFailedAttempt?.(lastError, attemptNumber);

      // Return the wait time for p-retry
      return new Promise(resolve => setTimeout(resolve, finalDelay));
    },
  } as const;

  // Add onSucceeded if provided
  if (onSuccess) {
    ;(attemptOptions as any).onSucceeded = (
      result: T,
      currentAttempt: number
    ) => onSuccess(result, currentAttempt + 1);
  }

  try {
    const result = await pRetry(fn, attemptOptions);
    return {
      result,
      attempts: maxAttempts,
      succeeded: true,
    };
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
    return {
      result: lastError as unknown as T,
      attempts: maxAttempts,
      succeeded: false,
      lastError,
    };
  }
}

export default pollWithBackoff;
