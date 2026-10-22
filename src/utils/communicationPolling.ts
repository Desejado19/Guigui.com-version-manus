export interface CommunicationEventSource {
  addEventListener: (event: string, listener: () => void) => void;
  close: () => void;
}

export const startCommunicationPolling = (
  refresh: () => void,
  createEventSource: () => CommunicationEventSource,
  intervalMs = 10_000,
): (() => void) => {
  let eventSource: CommunicationEventSource | null = null;
  try {
    eventSource = createEventSource();
    eventSource.addEventListener('conversation', refresh);
    eventSource.addEventListener('support', refresh);
  } catch {
    eventSource = null;
  }
  const timer = window.setInterval(refresh, intervalMs);
  return () => {
    window.clearInterval(timer);
    eventSource?.close();
  };
};
