export type TelemetryEvent = {
  type: string;
  at: string;
  metadata?: Record<string, any>;
};

const LS_TELEMETRY_KEY = 'telemetry_events';

export function trackEvent(type: string, metadata?: Record<string, any>) {
  try {
    const raw = localStorage.getItem(LS_TELEMETRY_KEY);
    const events: TelemetryEvent[] = raw ? JSON.parse(raw) : [];
    const moduleContext = metadata?.module_context ?? metadata?.module ?? 'unknown';
    const entryMeta = metadata ? { ...metadata, module_context: moduleContext } : { module_context: moduleContext };
    events.push({ type, at: new Date().toISOString(), metadata: entryMeta });
    localStorage.setItem(LS_TELEMETRY_KEY, JSON.stringify(events));
  } catch (e) {
    // Non-fatal: ignore telemetry failures
    // eslint-disable-next-line no-console
    console.debug('Telemetry error', e);
  }
}

export function getEvents(limit = 100): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(LS_TELEMETRY_KEY);
    const events: TelemetryEvent[] = raw ? JSON.parse(raw) : [];
    return events.slice(-limit);
  } catch {
    return [];
  }
}