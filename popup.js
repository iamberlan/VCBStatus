import { banEndMilliseconds, timeRemaining } from "./status.mjs";

const status = document.querySelector("#status");
const remaining = document.querySelector("#remaining");
const refresh = document.querySelector("#refresh");
const notifications = document.querySelector("#notifications");
let countdown;

async function loadNotificationSetting() {
  try {
    const saved = await chrome.storage.local.get("notificationsEnabled");
    notifications.checked = saved.notificationsEnabled !== false;
    notifications.disabled = false;
  } catch (error) {
    console.warn("Could not load notification setting", error);
  }
}

notifications.addEventListener("change", async () => {
  const enabled = notifications.checked;
  notifications.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "notifications-setting",
      enabled
    });
    if (!response?.ok) throw new Error("Setting was not saved");
    notifications.title = "";
  } catch (error) {
    notifications.checked = !enabled;
    notifications.title = "Could not save setting. Try again.";
    console.warn("Could not save notification setting", error);
  } finally {
    notifications.disabled = false;
  }
});

async function checkStatus() {
  clearInterval(countdown);
  refresh.disabled = true;
  status.textContent = "Checking…";
  remaining.hidden = true;

  try {
    const response = await fetch("https://voice.roblox.com/v1/settings", {
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });

    if (response.status === 401 || response.status === 403) {
      status.textContent = "Sign in to Roblox";
      return;
    }
    if (response.status === 429) {
      status.textContent = "Too many requests. Try again later.";
      return;
    }
    if (!response.ok) throw new Error("Request failed");

    const settings = await response.json();
    if (typeof settings.isBanned !== "boolean") throw new Error("Invalid response");

    const end = banEndMilliseconds(settings.bannedUntil);
    // Scheduling lives in the worker so closing the popup cannot cancel it.
    chrome.runtime.sendMessage({
      type: "voice-status",
      isBanned: settings.isBanned,
      end
    }).catch(error => console.warn("Could not schedule ban notification", error));

    status.textContent = settings.isBanned ? "Voice banned" : "Not voice banned";
    if (!settings.isBanned) return;

    remaining.hidden = false;
    if (end === null) {
      remaining.textContent = "Time remaining unavailable";
      return;
    }

    const update = () => {
      if (end <= Date.now()) {
        remaining.textContent = "0s remaining — refresh to confirm";
        clearInterval(countdown);
      } else {
        remaining.textContent = timeRemaining(end);
      }
    };
    countdown = setInterval(update, 1000);
    update();
  } catch {
    status.textContent = "Unable to check status";
  } finally {
    refresh.disabled = false;
  }
}

refresh.addEventListener("click", checkStatus);
loadNotificationSetting();
checkStatus();
