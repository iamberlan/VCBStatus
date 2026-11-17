const ALARM = "voice-ban-expiry";
const KEY = "voiceBanReminder";

// Serialize startup, refreshes and alarms to avoid duplicate notifications.
let pending = Promise.resolve();
function enqueue(task) {
  const result = pending.then(task);
  pending = result.catch(error => console.warn("Ban reminder failed", error));
  return result;
}

async function restoreReminder() {
  const { [KEY]: reminder, notificationsEnabled } =
    await chrome.storage.local.get([KEY, "notificationsEnabled"]);
  if (notificationsEnabled === false || !reminder?.end || reminder.notifiedEnd === reminder.end) {
    await chrome.alarms.clear(ALARM);
    return;
  }

  if (reminder.end > Date.now()) {
    const alarm = await chrome.alarms.get(ALARM);
    if (alarm?.scheduledTime !== reminder.end) {
      await chrome.alarms.create(ALARM, { when: reminder.end });
    }
    return;
  }

  await chrome.notifications.create(ALARM, {
    type: "basic",
    iconUrl: "notification.png",
    title: "Voice ban timer expired",
    message: "Your Roblox voice ban timer has expired. Refresh the extension to confirm your status."
  });
  await chrome.storage.local.set({
    [KEY]: { ...reminder, notifiedEnd: reminder.end }
  });
  await chrome.alarms.clear(ALARM);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id ||
      sender.url !== chrome.runtime.getURL("popup.html")) return;
  if (message?.type === "notifications-setting") {
    if (typeof message.enabled !== "boolean") return;
  } else if (message?.type === "voice-status") {
    if (typeof message.isBanned !== "boolean" ||
      (message.end !== null && (!Number.isFinite(message.end) || message.end <= 0))) return;
  } else {
    return;
  }

  enqueue(async () => {
    if (message.type === "notifications-setting") {
      await chrome.storage.local.set({ notificationsEnabled: message.enabled });
    } else {
      const { [KEY]: previous } = await chrome.storage.local.get(KEY);
      await chrome.storage.local.set({
        [KEY]: {
          end: message.isBanned ? message.end : null,
          notifiedEnd: previous?.notifiedEnd ?? null
        }
      });
    }
    await restoreReminder();
  }).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
  return true;
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM) enqueue(restoreReminder);
});
chrome.runtime.onStartup.addListener(() => { enqueue(restoreReminder); });
chrome.runtime.onInstalled.addListener(() => { enqueue(restoreReminder); });

// Recreate a missing alarm whenever the worker starts, including after restart.
enqueue(restoreReminder);
