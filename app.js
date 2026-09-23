"use strict";

const SETTINGS = { bookJson: "./book.json", language: "ja-JP", rate: 0.82, pitch: 1.05, volume: 1, defaultDurationMs: 7000, imageTimeoutMs: 8000 };
const ui = {
  reader: document.querySelector("#reader"), image: document.querySelector("#page-image"), number: document.querySelector("#page-number"),
  startScreen: document.querySelector("#start-screen"), stationButton: document.querySelector("#station-button"), dadadaButton: document.querySelector("#dadada-button"), status: document.querySelector("#status"),
  pauseButton: document.querySelector("#pause-button"), resumeScreen: document.querySelector("#resume-screen"), resumeButton: document.querySelector("#resume-button"), homeButton: document.querySelector("#home-button")
};

let modes = {}; let pages = []; let currentMode = "station"; let currentPage = 0; let playing = false; let wakeLock = null; let timer = null; let runId = 0;

async function loadBook() {
  const response = await fetch(SETTINGS.bookJson, { cache: "no-cache" });
  if (!response.ok) throw new Error("案内データを読み込めませんでした");
  const data = await response.json();
  for (const [id, mode] of Object.entries(data.modes || {})) {
    modes[id] = { title: String(mode.title || id), pages: (mode.pages || []).map(page => ({ image: String(page.image || "").trim(), speech: String(page.speech || "").trim(), durationMs: Number(page.durationMs || 0) })).filter(page => page.image) };
  }
  if (!modes.station || modes.station.pages.length !== 3 || !modes.dadada?.pages.length) throw new Error("案内データの構成を確認してください");
}

function waitForImage(src) {
  return new Promise(resolve => {
    let doneAlready = false;
    const done = () => { if (!doneAlready) { doneAlready = true; clearTimeout(timeout); resolve(); } };
    const timeout = window.setTimeout(done, SETTINGS.imageTimeoutMs);
    ui.image.onload = done; ui.image.onerror = done; ui.image.src = src; if (ui.image.complete) done();
  });
}

function getJapaneseVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find(v => v.lang.toLowerCase() === "ja-jp") || voices.find(v => v.lang.toLowerCase().startsWith("ja")) || null;
}

function speak(text, token) {
  return new Promise(resolve => {
    if (!playing || token !== runId || !text) return resolve();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SETTINGS.language; utterance.rate = SETTINGS.rate; utterance.pitch = SETTINGS.pitch; utterance.volume = SETTINGS.volume;
    const voice = getJapaneseVoice(); if (voice) utterance.voice = voice;
    utterance.onend = resolve; utterance.onerror = resolve; speechSynthesis.cancel(); speechSynthesis.speak(utterance);
  });
}

function delay(ms, token) { return new Promise(resolve => { timer = window.setTimeout(() => { timer = null; resolve(token === runId); }, ms); }); }

async function playPage(token) {
  if (!playing || token !== runId) return;
  const page = pages[currentPage];
  ui.number.textContent = currentMode === "station" ? `${currentPage + 1} / 3` : "";
  ui.image.alt = currentMode === "station" ? `駅IC案内 ${currentPage + 1}枚目` : "だっだぁー";
  await waitForImage(page.image);
  if (!playing || token !== runId) return;
  if (page.speech) await speak(page.speech, token);
  if (!playing || token !== runId) return;
  const ok = await delay(page.durationMs || SETTINGS.defaultDurationMs, token);
  if (!ok || !playing) return;
  currentPage = (currentPage + 1) % pages.length;
  playPage(token);
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } catch (error) { console.info("Wake Lockは利用できません", error.name); }
}

function stop(showResume = true) {
  playing = false; runId += 1; speechSynthesis.cancel(); if (timer) clearTimeout(timer); timer = null;
  if (wakeLock) wakeLock.release().catch(() => {}); if (showResume) ui.resumeScreen.hidden = false;
}

async function start(mode, resetPage = true) {
  currentMode = mode; pages = modes[mode].pages; if (resetPage) currentPage = 0;
  speechSynthesis.cancel(); playing = true; runId += 1; const token = runId;
  ui.startScreen.hidden = true; ui.resumeScreen.hidden = true; ui.reader.hidden = false; ui.pauseButton.hidden = false;
  await requestWakeLock(); playPage(token);
}

function returnHome() {
  stop(false); ui.resumeScreen.hidden = true; ui.reader.hidden = true; ui.pauseButton.hidden = true; ui.startScreen.hidden = false; currentPage = 0;
}

ui.stationButton.addEventListener("click", () => start("station"));
ui.dadadaButton.addEventListener("click", () => start("dadada"));
ui.pauseButton.addEventListener("click", () => stop(true));
ui.resumeButton.addEventListener("click", () => start(currentMode, false));
ui.homeButton.addEventListener("click", returnHome);

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && playing) { await requestWakeLock(); speechSynthesis.cancel(); runId += 1; playPage(runId); }
});
window.addEventListener("pagehide", () => stop(false));
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.warn));

loadBook().then(() => { ui.status.textContent = "3枚の案内を繰り返し表示します"; ui.stationButton.disabled = false; ui.dadadaButton.disabled = false; }).catch(error => { ui.status.textContent = error.message; ui.status.setAttribute("role", "alert"); });
