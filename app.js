"use strict";

const SETTINGS = {
  bookJson: "./book.json",
  bookText: "./book.txt",
  language: "ja-JP",
  rate: 0.82,
  pitch: 1.05,
  volume: 1,
  pauseBetweenPagesMs: 650,
  loopPauseMs: 20000,
  imageTimeoutMs: 8000
};

const ui = {
  reader: document.querySelector("#reader"),
  image: document.querySelector("#page-image"),
  text: document.querySelector("#page-text"),
  number: document.querySelector("#page-number"),
  startScreen: document.querySelector("#start-screen"),
  startButton: document.querySelector("#start-button"),
  status: document.querySelector("#status"),
  pauseButton: document.querySelector("#pause-button"),
  resumeScreen: document.querySelector("#resume-screen"),
  resumeButton: document.querySelector("#resume-button")
};

let pages = [];
let currentPage = 0;
let playing = false;
let wakeLock = null;
let pageTimer = null;
let runId = 0;

async function loadBook() {
  try {
    const response = await fetch(SETTINGS.bookJson, { cache: "no-cache" });
    if (!response.ok) throw new Error("book.json が見つかりません");

    const data = await response.json();
    pages = Array.isArray(data) ? data : data.pages;
  } catch (jsonError) {
    try {
      const response = await fetch(SETTINGS.bookText, { cache: "no-cache" });
      if (!response.ok) throw new Error("book.txt が見つかりません");

      pages = parseBookText(await response.text());
    } catch (textError) {
      throw new Error(
        "book.json または book.txt を読み込めませんでした"
      );
    }
  }

  pages = pages
    .map(page => ({
      image: String(page.image || "").trim(),
      text: String(page.text || "").trim()
    }))
    .filter(page => page.image && page.text);

  if (!pages.length) {
    throw new Error("絵本に有効なページがありません");
  }
}

function parseBookText(source) {
  return source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(line => {
      const separator = line.indexOf("|");

      return separator < 0
        ? {}
        : {
            image: line.slice(0, separator).trim(),
            text: line.slice(separator + 1).trim()
          };
    });
}

function waitForImage(src) {
  return new Promise(resolve => {
    const done = () => resolve();

    const timeout = window.setTimeout(
      done,
      SETTINGS.imageTimeoutMs
    );

    ui.image.onload = () => {
      clearTimeout(timeout);
      done();
    };

    ui.image.onerror = () => {
      clearTimeout(timeout);
      done();
    };

    ui.image.src = src;

    if (ui.image.complete) {
      clearTimeout(timeout);
      done();
    }
  });
}

function getJapaneseVoice() {
  const voices = speechSynthesis.getVoices();

  return (
    voices.find(
      voice => voice.lang.toLowerCase() === "ja-jp"
    ) ||
    voices.find(
      voice => voice.lang.toLowerCase().startsWith("ja")
    ) ||
    null
  );
}

function speak(text, token) {
  return new Promise(resolve => {
    if (!playing || token !== runId) {
      return resolve();
    }

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang = SETTINGS.language;
    utterance.rate = SETTINGS.rate;
    utterance.pitch = SETTINGS.pitch;
    utterance.volume = SETTINGS.volume;

    const voice = getJapaneseVoice();

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = resolve;
    utterance.onerror = resolve;

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  });
}

function delay(ms, token) {
  return new Promise(resolve => {
    pageTimer = window.setTimeout(() => {
      pageTimer = null;
      resolve(token === runId);
    }, ms);
  });
}

async function playPage(token) {
  if (!playing || token !== runId) {
    return;
  }

  const page = pages[currentPage];

  ui.text.textContent = page.text;
  ui.number.textContent =
    `${currentPage + 1} / ${pages.length}`;

  ui.image.alt =
    `${currentPage + 1}ページ目の絵`;

  await waitForImage(page.image);

  if (!playing || token !== runId) {
    return;
  }

  await speak(page.text, token);

  if (!playing || token !== runId) {
    return;
  }

  const isLast =
    currentPage === pages.length - 1;

  const continued = await delay(
    isLast
      ? SETTINGS.loopPauseMs
      : SETTINGS.pauseBetweenPagesMs,
    token
  );

  if (!continued || !playing) {
    return;
  }

  currentPage =
    (currentPage + 1) % pages.length;

  playPage(token);
}

async function requestWakeLock() {
  if (
    !("wakeLock" in navigator) ||
    document.visibilityState !== "visible"
  ) {
    return;
  }

  try {
    wakeLock =
      await navigator.wakeLock.request("screen");

    wakeLock.addEventListener(
      "release",
      () => {
        wakeLock = null;
      }
    );
  } catch (error) {
    console.info(
      "Wake Lockは利用できません:",
      error.name
    );
  }
}

function stopPlayback(showResume = true) {
  playing = false;
  runId += 1;

  speechSynthesis.cancel();

  if (pageTimer) {
    clearTimeout(pageTimer);
  }

  pageTimer = null;

  if (wakeLock) {
    wakeLock.release().catch(() => {});
  }

  if (showResume) {
    ui.resumeScreen.hidden = false;
  }
}

async function startPlayback() {
  speechSynthesis.cancel();

  playing = true;
  runId += 1;

  const token = runId;

  ui.startScreen.hidden = true;
  ui.resumeScreen.hidden = true;
  ui.reader.hidden = false;
  ui.pauseButton.hidden = false;

  await requestWakeLock();

  playPage(token);
}

ui.startButton.addEventListener(
  "click",
  startPlayback
);

ui.pauseButton.addEventListener(
  "click",
  () => stopPlayback(true)
);

ui.resumeButton.addEventListener(
  "click",
  startPlayback
);

document.addEventListener(
  "visibilitychange",
  async () => {
    if (
      document.visibilityState === "visible" &&
      playing
    ) {
      await requestWakeLock();

      // iOSはバックグラウンド移行後に
      // 読み上げが止まるため、
      // 現在ページから安全に再開する。
      speechSynthesis.cancel();

      runId += 1;
      playPage(runId);
    }
  }
);

window.addEventListener(
  "pagehide",
  () => stopPlayback(false)
);

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () =>
      navigator.serviceWorker
        .register("./sw.js")
        .catch(console.warn)
  );
}

loadBook()
  .then(() => {
    ui.status.textContent =
      `${pages.length}ページの えほんです`;

    ui.startButton.disabled = false;
  })
  .catch(error => {
    ui.status.textContent = error.message;
    ui.status.setAttribute("role", "alert");
  });