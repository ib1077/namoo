"use strict";

const CONFIG = {
  bookFile: "./book.json",
  lang: "ja-JP",
  rate: 0.82,
  pitch: 1.05,
  volume: 1,
  gapMs: 700,
  loopGapMs: 1400,
  imageWaitMs: 8000
};

const el = {
  signage: document.querySelector("#signage"),
  image: document.querySelector("#slide-image"),
  text: document.querySelector("#slide-text"),
  counter: document.querySelector("#slide-counter"),
  startScreen: document.querySelector("#start-screen"),
  startButton: document.querySelector("#start-button"),
  status: document.querySelector("#status"),
  pauseButton: document.querySelector("#pause-button"),
  resumeScreen: document.querySelector("#resume-screen"),
  resumeButton: document.querySelector("#resume-button")
};

let slides = [];
let index = 0;
let playing = false;
let runToken = 0;
let timer = null;
let wakeLock = null;

async function loadSlides() {
  const response = await fetch(CONFIG.bookFile, { cache: "no-cache" });
  if (!response.ok) throw new Error("book.jsonを読み込めませんでした");
  const data = await response.json();
  const source = Array.isArray(data) ? data : data.pages;
  slides = (source || []).map(item => ({
    image: String(item.image || "").trim(),
    text: String(item.text || "").trim()
  })).filter(item => item.image && item.text).slice(0, 3);
  if (slides.length !== 3) throw new Error("book.jsonには3枚を設定してください");
}

function waitForImage(src) {
  return new Promise(resolve => {
    let finished = false;
    const done = () => { if (!finished) { finished = true; clearTimeout(timeout); resolve(); } };
    const timeout = window.setTimeout(done, CONFIG.imageWaitMs);
    el.image.onload = done;
    el.image.onerror = done;
    el.image.src = src;
    if (el.image.complete) done();
  });
}

function japaneseVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find(v => v.lang.toLowerCase() === "ja-jp") || voices.find(v => v.lang.toLowerCase().startsWith("ja")) || null;
}

function speak(text, token) {
  return new Promise(resolve => {
    if (!playing || token !== runToken) return resolve();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = CONFIG.lang;
    utterance.rate = CONFIG.rate;
    utterance.pitch = CONFIG.pitch;
    utterance.volume = CONFIG.volume;
    const voice = japaneseVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = resolve;
    utterance.onerror = resolve;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  });
}

function delay(ms, token) {
  return new Promise(resolve => {
    timer = window.setTimeout(() => { timer = null; resolve(token === runToken); }, ms);
  });
}

async function showSlide(token) {
  if (!playing || token !== runToken) return;
  const slide = slides[index];
  el.text.textContent = slide.text;
  el.counter.textContent = `${index + 1} / 3`;
  el.image.alt = `${index + 1}枚目`;
  await waitForImage(slide.image);
  if (!playing || token !== runToken) return;
  await speak(slide.text, token);
  if (!playing || token !== runToken) return;
  const continued = await delay(index === 2 ? CONFIG.loopGapMs : CONFIG.gapMs, token);
  if (!continued || !playing) return;
  index = (index + 1) % 3;
  showSlide(token);
}

async function acquireWakeLock() {
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch (error) {
    console.info("Wake Lockは利用できません", error.name);
  }
}

function stop(showResume) {
  playing = false;
  runToken += 1;
  speechSynthesis.cancel();
  if (timer) clearTimeout(timer);
  timer = null;
  if (wakeLock) wakeLock.release().catch(() => {});
  if (showResume) el.resumeScreen.hidden = false;
}

async function start() {
  speechSynthesis.cancel();
  playing = true;
  runToken += 1;
  const token = runToken;
  el.startScreen.hidden = true;
  el.resumeScreen.hidden = true;
  el.signage.hidden = false;
  el.pauseButton.hidden = false;
  await acquireWakeLock();
  showSlide(token);
}

el.startButton.addEventListener("click", start);
el.pauseButton.addEventListener("click", () => stop(true));
el.resumeButton.addEventListener("click", start);

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && playing) {
    await acquireWakeLock();
    speechSynthesis.cancel();
    runToken += 1;
    showSlide(runToken);
  }
});

window.addEventListener("pagehide", () => stop(false));
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.warn));

loadSlides().then(() => {
  el.status.textContent = "3まいの おはなしです";
  el.startButton.disabled = false;
}).catch(error => {
  el.status.textContent = error.message;
  el.status.setAttribute("role", "alert");
});
