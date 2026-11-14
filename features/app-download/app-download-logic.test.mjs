// Page /app « Télécharger l'application » — règle pure (2026-11-14).
// node --test features/app-download/app-download-logic.test.mjs  (npm run check:app)
import { test } from "node:test";
import assert from "node:assert/strict";
import { appPageTarget } from "./app-download-logic.ts";

const PLAY = "https://play.google.com/store/apps/details?id=com.rivendy.app";
const UA = {
  androidChrome: "Mozilla/5.0 (Linux; Android 14; SM-A156B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  samsung: "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  tecno: "Mozilla/5.0 (Linux; Android 12; TECNO KI5q Build/SP1A.210812.016) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  facebookAndroid: "Mozilla/5.0 (Linux; Android 14; SM-A256B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/485.0.0.0;]",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  facebookIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/485.0.0.0]",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  googlebotSmartphone: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  whatsappPreview: "WhatsApp/2.24.21.80 A",
  facebookPreview: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
};

test("Android (Chrome, Samsung, Tecno, navigateur de Facebook) → fiche Google Play", () => {
  for (const ua of [UA.androidChrome, UA.samsung, UA.tecno, UA.facebookAndroid]) {
    assert.deepEqual(appPageTarget(ua, PLAY), { kind: "android", url: PLAY });
  }
});

test("iPhone et iPad (Safari, navigateur de Facebook) → page iPhone, jamais Google Play", () => {
  for (const ua of [UA.iphone, UA.ipad, UA.facebookIphone]) {
    assert.deepEqual(appPageTarget(ua, PLAY), { kind: "ios" });
  }
});

test("ordinateur → la page (badge + QR code)", () => {
  assert.deepEqual(appPageTarget(UA.windows, PLAY), { kind: "other" });
  assert.deepEqual(appPageTarget(UA.mac, PLAY), { kind: "other" });
});

test("robots et aperçus de liens : jamais redirigés, même avec « Android » dans leur signature", () => {
  for (const ua of [UA.googlebotSmartphone, UA.whatsappPreview, UA.facebookPreview]) {
    assert.deepEqual(appPageTarget(ua, PLAY), { kind: "other" });
  }
});

test("signature absente → la page", () => {
  assert.deepEqual(appPageTarget("", PLAY), { kind: "other" });
  assert.deepEqual(appPageTarget(null, PLAY), { kind: "other" });
  assert.deepEqual(appPageTarget(undefined, PLAY), { kind: "other" });
});
