"use strict";
const updateButton = document.querySelector("#updateBtn");
const updateStatus = document.querySelector("#updateStatus");
document.querySelector("#appVersion").textContent = "ver. " + EHON_VERSION;
function statusOf(worker) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); reject(new Error("応答なし")); }, 5000);
    channel.port1.onmessage = event => { clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
    worker.postMessage({ type: "STATUS" }, [channel.port2]);
  });
}
function waitForInstall(registration) {
  const worker = registration.installing;
  if (!worker) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error("取得時間切れ")), 90000);
    function finish(error) { clearTimeout(timeout); worker.removeEventListener("statechange", check); error ? reject(error) : resolve(); }
    function check() {
      if (worker.state === "installed" || worker.state === "activated") finish();
      else if (worker.state === "redundant") finish(new Error("取得失敗"));
    }
    worker.addEventListener("statechange", check);
    check();
  });
}
async function registerOffline() {
  const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
  await waitForInstall(registration);
  await navigator.serviceWorker.ready;
  const status = await statusOf(registration.active);
  updateStatus.textContent = status.ready ? "オフラインで使えます" : "オフライン保存を準備しています";
  return registration;
}
if ("serviceWorker" in navigator) {
  registerOffline().catch(() => { updateStatus.textContent = "オフライン保存を確認できませんでした。オンラインで更新してください。"; });
} else {
  updateButton.disabled = true;
  updateStatus.textContent = "この環境ではオフライン保存に対応していません";
}
updateButton.addEventListener("click", async () => {
  updateButton.disabled = true;
  updateStatus.textContent = "更新を確認しています…";
  try {
    if (!navigator.onLine) throw new Error("オフライン");
    const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
    await registration.update();
    await waitForInstall(registration);
    const worker = registration.waiting || registration.active;
    if (!worker) throw new Error("更新未準備");
    const status = await statusOf(worker);
    if (!status.ready) throw new Error("保存未完了");
    if (registration.waiting) {
      updateStatus.textContent = "新版へ切り替えています…";
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { navigator.serviceWorker.removeEventListener("controllerchange", changed); reject(new Error("切替時間切れ")); }, 15000);
        function changed() { clearTimeout(timeout); navigator.serviceWorker.removeEventListener("controllerchange", changed); resolve(); }
        navigator.serviceWorker.addEventListener("controllerchange", changed);
        worker.postMessage({ type: "ACTIVATE" });
      });
    }
    location.reload();
  } catch (_) {
    updateStatus.textContent = "更新できませんでした。現在のバージョンを使用します";
    updateButton.disabled = false;
  }
});
