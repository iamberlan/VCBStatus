export function banEndMilliseconds(bannedUntil) {
  if (!bannedUntil || bannedUntil.Seconds == null) return null;
  const seconds = Number(bannedUntil.Seconds);
  const nanos = Number(bannedUntil.Nanos ?? 0);
  const milliseconds = seconds * 1000 + nanos / 1e6;
  if (!Number.isFinite(milliseconds) || seconds <= 0 ||
      !Number.isInteger(seconds) || !Number.isInteger(nanos) ||
      nanos < 0 || nanos >= 1e9 || milliseconds > 8.64e15) return null;
  return milliseconds;
}

export function timeRemaining(end, now = Date.now()) {
  let seconds = Math.max(0, Math.ceil((end - now) / 1000));
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  return `${days ? `${days}d ` : ""}${hours}h ${minutes}m ${seconds}s remaining`;
}
