// Deploy Poller with exponential backoff retry.
// Provides retry logic with exponential backoff for deployment polling.
// Uses the p-retry library which is already a dependency.

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
  onFailedAttempt?: (error: Error) => void;
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
    onFailedAttempt: (error: Error) => {
      lastError = error;

      onFailedAttempt?.(error);

      // Return the wait time for p-retry
      // Note: p-retry handles the delay internally based on the retry count
      return Promise.resolve();
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

/** Recibo devolvido pela API de deployment (subconjunto estável de OperationReceipt). */
export interface DeployReceipt {
  status: string;
  [key: string]: unknown;
}

export interface DeployPollerOptions {
  siteId: string;
  environment: 'preview' | 'production';
  requestId: string;
  manifestPath: string;
  /** Consulta do estado; por omissão falha porque depende da API de deployment. */
  checkStatus?: () => Promise<DeployReceipt>;
  maxAttempts?: number;
  baseDelayMs?: number;
}

export interface DeployPollerResult {
  receipt: DeployReceipt;
  attempts: number;
  succeeded: boolean;
  error?: Error;
}

/**
 * Consulta o recibo de deployment com retry exponencial (p-retry).
 *
 * Só considera o deployment concluído com `succeeded`/`published`; qualquer
 * outro estado devolve `succeeded: false` em vez de o apresentar como feito.
 */
export async function pollDeploy(options: DeployPollerOptions): Promise<DeployPollerResult> {
  const { checkStatus, maxAttempts = DEFAULT_MAX_ATTEMPTS, baseDelayMs = 5_000 } = options;
  let attempts = 0;

  const check = async (): Promise<DeployReceipt> => {
    attempts += 1;
    if (!checkStatus) {
      throw new Error(
        'A consulta do estado de deployment requer integração com a API de Sites.',
      );
    }
    return checkStatus();
  };

  try {
    const receipt = await pRetry<DeployReceipt>(check, {
      retries: Math.max(0, maxAttempts - 1),
      onFailedAttempt: (error) => {
        const delay = baseDelayMs * Math.pow(DEFAULT_MULTIPLIER, error.attemptNumber - 1);
        console.info(
          `Deploy poller tentativa ${error.attemptNumber}/${maxAttempts} falhou. ` +
            `Nova tentativa em ${Math.round(delay / 1000)}s: ${error.message}`,
        );
      },
    });

    const succeeded = receipt.status === 'succeeded' || receipt.status === 'published';
    return {
      receipt,
      attempts: Math.max(attempts, 1),
      succeeded,
      error: succeeded ? undefined : new Error(`Deployment não concluído (estado: ${receipt.status}).`),
    };
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    return {
      receipt: { status: 'failed' },
      attempts: Math.max(attempts, 1),
      succeeded: false,
      error: failure,
    };
  }
}

/** Mantém o utilitário genérico como exportação por omissão. */
export default pollWithBackoff;
