// "No-trade" windows: times of day in which no NEW trade is opened.
// Shared by the Dashboard card, the autopilot config and the Hyperliquid auto trader.

export interface TradeWindow {
  // "HH:MM" in the user's local time
  from: string;
  to: string;
}

const STORAGE_KEY = 'no-trade-windows';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isValidWindow = (w: TradeWindow): boolean => TIME.test(w.from) && TIME.test(w.to) && w.from !== w.to;

export const loadWindows = (): TradeWindow[] => {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter(isValidWindow) : [];
  } catch {
    return [];
  }
};

export const saveWindows = (windows: TradeWindow[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(windows));
  } catch {
    // storage unavailable
  }
};

// Minutes east of UTC for the browser, e.g. Tehran = 210
export const localTzOffsetMinutes = (): number => -new Date().getTimezoneOffset();

const minutesOf = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// True when the minute-of-day `now` falls inside the window; windows may wrap midnight (22:00 -> 02:00)
const contains = (w: TradeWindow, now: number): boolean => {
  const from = minutesOf(w.from);
  const to = minutesOf(w.to);
  return from < to ? now >= from && now < to : now >= from || now < to;
};

// The window that pauses trading right now, or null
export const activeWindow = (windows: TradeWindow[], date = new Date()): TradeWindow | null => {
  const now = date.getHours() * 60 + date.getMinutes();
  return windows.find((w) => isValidWindow(w) && contains(w, now)) ?? null;
};
