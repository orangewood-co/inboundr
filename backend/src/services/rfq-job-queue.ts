// RFQ processing runs a chain of LLM calls plus Postgres product searches per
// request. A backlog catch-up (Gmail) or a burst of chats (WhatsApp) can queue
// dozens at once; firing them all floods the LLM provider and lets the
// searches starve the shared 10-connection Postgres pool that HTTP requests
// also use, so every source queues behind this one semaphore.
const MAX_CONCURRENT_RFQ_JOBS = 5;
let activeRfqJobs = 0;
const rfqJobWaiters: Array<() => void> = [];

export async function withRfqSlot<T>(fn: () => Promise<T>): Promise<T> {
  while (activeRfqJobs >= MAX_CONCURRENT_RFQ_JOBS) {
    await new Promise<void>((resolve) => rfqJobWaiters.push(resolve));
  }
  activeRfqJobs++;
  try {
    return await fn();
  } finally {
    activeRfqJobs--;
    rfqJobWaiters.shift()?.();
  }
}
