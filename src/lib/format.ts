// Small text helpers shared by the new pages and components.

// 83924.7512 -> "83924.75", 0.0012345 -> "0.0012345"
export const formatPrice = (value: number): string =>
  value >= 1000 ? value.toFixed(2) : Number(value.toPrecision(5)).toString();

// 1.5 -> "+1.50%", -2 -> "-2.00%"
export const formatSignedPct = (value: number): string =>
  `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

// 58.9 -> "58.9%"
export const formatPct = (value: number): string => `${value.toFixed(1)}%`;

// 90 minutes -> "1.5h", 30 minutes -> "30m", 2 days -> "2.0d"
export const formatDuration = (ms: number): string => {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

// -> "Sep 25, 2026"
export const formatDay = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

// -> "Sep 25, 05:45 PM"
export const formatDateTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
