#include <ESP8266WiFi.h>
#include <FastLED.h>

// ─── Hardware ────────────────────────────────────────────────────────────
#define LED_PIN_1    5      // D1 -> Panel 1
#define LED_PIN_2    4      // D2 -> Panel 2
#define LED_PIN_3   14      // D5 -> Panel 3
#define LED_PIN_4   12      // D6 -> Panel 4
#define PANEL_LEDS  16
#define LED_TYPE     WS2812B
#define COLOR_ORDER  GRB

CRGB leds1[PANEL_LEDS];
CRGB leds2[PANEL_LEDS];
CRGB leds3[PANEL_LEDS];
CRGB leds4[PANEL_LEDS];

// ─── Runtime State ───────────────────────────────────────────────────────
enum Mode : uint8_t {
  MODE_INFINITY = 0,
  MODE_SOLID,
  MODE_PULSE,
  MODE_RAINBOW,
  MODE_COMET,
  MODE_THEATER,
  MODE_FIRE,
  MODE_SPARKLE,
  MODE_WIPE,
  MODE_BREATHE,
  MODE_COUNT
};

struct State {
  Mode     mode  = MODE_INFINITY;
  uint8_t  bri   = 170;
  uint16_t speed = 3000;   // period in ms
  uint8_t  hue   = 170;
  uint8_t  sat   = 210;
};
static State S;

// ─── Serial Line Parser ──────────────────────────────────────────────────
// Buffer must hold "frame:" + 384 hex chars + null = 391 bytes; round up.
static char lineBuf[480];
static uint16_t lineLen = 0;

// ─── Frame streaming state ──────────────────────────────────────────────
static uint32_t lastStreamMs = 0;
static const uint32_t STREAM_OVERRIDE_MS = 250;

static inline uint8_t hexNibble(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return 10 + c - 'a';
  if (c >= 'A' && c <= 'F') return 10 + c - 'A';
  return 0;
}

static void applyFrameHex(const char* hex) {
  // Expect 384 hex chars = 192 bytes = 4 panels × 16 LEDs × 3 bytes RGB.
  size_t len = strlen(hex);
  if (len < 384) return;
  CRGB* panels[4] = {leds1, leds2, leds3, leds4};
  for (uint8_t p = 0; p < 4; p++) {
    for (uint8_t i = 0; i < PANEL_LEDS; i++) {
      const char* c = hex + (p * PANEL_LEDS + i) * 6;
      uint8_t r = (hexNibble(c[0]) << 4) | hexNibble(c[1]);
      uint8_t g = (hexNibble(c[2]) << 4) | hexNibble(c[3]);
      uint8_t b = (hexNibble(c[4]) << 4) | hexNibble(c[5]);
      panels[p][i] = CRGB(r, g, b);
    }
  }
  lastStreamMs = millis();
}

static void applyKV(const char* k, const char* v) {
  if (!strcmp(k, "mode")) {
    Mode newMode = S.mode;
    if      (!strcmp(v, "infinity"))  newMode = MODE_INFINITY;
    else if (!strcmp(v, "solid"))     newMode = MODE_SOLID;
    else if (!strcmp(v, "pulse"))     newMode = MODE_PULSE;
    else if (!strcmp(v, "rainbow"))   newMode = MODE_RAINBOW;
    else if (!strcmp(v, "comet"))     newMode = MODE_COMET;
    else if (!strcmp(v, "theater"))   newMode = MODE_THEATER;
    else if (!strcmp(v, "fire"))      newMode = MODE_FIRE;
    else if (!strcmp(v, "sparkle"))   newMode = MODE_SPARKLE;
    else if (!strcmp(v, "wipe"))      newMode = MODE_WIPE;
    else if (!strcmp(v, "breathe"))   newMode = MODE_BREATHE;
    if (newMode != S.mode) {
      S.mode = newMode;
      fill_solid(leds1, PANEL_LEDS, CRGB::Black);
      fill_solid(leds2, PANEL_LEDS, CRGB::Black);
      fill_solid(leds3, PANEL_LEDS, CRGB::Black);
      fill_solid(leds4, PANEL_LEDS, CRGB::Black);
    }
  } else if (!strcmp(k, "bri")) {
    int n = atoi(v); if (n < 0) n = 0; if (n > 255) n = 255;
    S.bri = (uint8_t)n;
    FastLED.setBrightness(S.bri);
  } else if (!strcmp(k, "speed")) {
    long n = atol(v); if (n < 100) n = 100; if (n > 60000) n = 60000;
    S.speed = (uint16_t)n;
  } else if (!strcmp(k, "hue")) {
    int n = atoi(v); S.hue = (uint8_t)(n & 0xFF);
  } else if (!strcmp(k, "sat")) {
    int n = atoi(v); if (n < 0) n = 0; if (n > 255) n = 255;
    S.sat = (uint8_t)n;
  } else if (!strcmp(k, "frame")) {
    applyFrameHex(v);
  } else if (!strcmp(k, "ping")) {
    Serial.println(F("pong"));
  }
}

static void handleLine(char* line) {
  char* colon = strchr(line, ':');
  if (!colon) return;
  *colon = '\0';
  applyKV(line, colon + 1);
}

static void pollSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (lineLen > 0) {
        lineBuf[lineLen] = '\0';
        handleLine(lineBuf);
        lineLen = 0;
      }
    } else if (lineLen < sizeof(lineBuf) - 1) {
      lineBuf[lineLen++] = c;
    } else {
      lineLen = 0;  // overflow: drop
    }
  }
}

// ─── Effects ─────────────────────────────────────────────────────────────
// Infinity — four flares chase around each panel, 25 % phase-offset each.
static void renderInfinity(uint32_t ms) {
  CRGB* panels[4] = {leds1, leds2, leds3, leds4};
  for (uint8_t p = 0; p < 4; p++) fadeToBlackBy(panels[p], PANEL_LEDS, 35);

  uint32_t phase16 = (uint32_t)(ms % S.speed) * 65536UL / S.speed;
  CRGB col = CHSV(S.hue, S.sat, 255);

  for (uint8_t p = 0; p < 4; p++) {
    uint32_t ph = (phase16 + (uint32_t)p * 16384UL) & 0xFFFF;
    uint32_t subpos = ph * PANEL_LEDS;
    uint8_t idx  = (subpos >> 16) & 15;
    uint8_t frac = (subpos >> 8) & 0xFF;

    CRGB head = col; head.nscale8(255 - frac);
    CRGB next = col; next.nscale8(frac);
    panels[p][idx]             += head;
    panels[p][(idx + 1) & 15]  += next;
  }
}

static void renderSolid(uint32_t) {
  CRGB c = CHSV(S.hue, S.sat, 255);
  fill_solid(leds1, PANEL_LEDS, c);
  fill_solid(leds2, PANEL_LEDS, c);
  fill_solid(leds3, PANEL_LEDS, c);
  fill_solid(leds4, PANEL_LEDS, c);
}

// Pulse — cascading breath, 25 % phase offset per panel.
static void renderPulse(uint32_t ms) {
  CRGB* panels[4] = {leds1, leds2, leds3, leds4};
  for (uint8_t p = 0; p < 4; p++) {
    uint32_t t = (ms + (uint32_t)p * S.speed / 4) % S.speed;
    uint16_t ph16 = (uint32_t)t * 65536UL / S.speed;
    uint8_t v = cubicwave8(ph16 >> 8);
    CRGB c = CHSV(S.hue, S.sat, v);
    fill_solid(panels[p], PANEL_LEDS, c);
  }
}

// Rainbow — single hue gradient stretched across all four panels (64 LEDs total).
static void renderRainbow(uint32_t ms) {
  uint8_t basehue = (uint32_t)(ms % S.speed) * 256UL / S.speed;
  CRGB* panels[4] = {leds1, leds2, leds3, leds4};
  for (uint8_t p = 0; p < 4; p++) {
    uint8_t panelOff = p * 64;   // full rainbow spans all 4 panels
    for (uint8_t i = 0; i < PANEL_LEDS; i++) {
      panels[p][i] = CHSV(basehue + panelOff + i * 4, S.sat, 255);
    }
  }
}

// Comet — head per panel, phase-offset so the comet rolls through all four panels.
static void renderComet(uint32_t ms) {
  CRGB* panels[4] = {leds1, leds2, leds3, leds4};
  for (uint8_t p = 0; p < 4; p++) fadeToBlackBy(panels[p], PANEL_LEDS, 40);
  uint32_t phase = (uint32_t)(ms % S.speed) * PANEL_LEDS * 256UL / S.speed;
  uint8_t baseIdx = (phase >> 8) & 15;
  CRGB c = CHSV(S.hue, S.sat, 255);
  for (uint8_t p = 0; p < 4; p++) {
    uint8_t idx = (baseIdx + p * 4) & 15;
    panels[p][idx] = c;
  }
}

// Theater — triad chase with per-panel offset → horizontal barber-pole.
static void renderTheater(uint32_t ms) {
  uint16_t tick = S.speed / 20; if (tick < 50) tick = 50;
  uint32_t base = ms / tick;
  CRGB c = CHSV(S.hue, S.sat, 255);
  CRGB* panels[4] = {leds1, leds2, leds3, leds4};
  for (uint8_t p = 0; p < 4; p++) {
    uint8_t step = (base + p) % 3;
    for (uint8_t i = 0; i < PANEL_LEDS; i++) {
      panels[p][i] = (i % 3 == step) ? c : CRGB::Black;
    }
  }
}

static void renderFire(uint32_t ms) {
  static uint8_t heat1[PANEL_LEDS];
  static uint8_t heat2[PANEL_LEDS];
  static uint8_t heat3[PANEL_LEDS];
  static uint8_t heat4[PANEL_LEDS];
  static uint32_t lastUpdate = 0;
  uint16_t interval = S.speed / 60; if (interval < 10) interval = 10;
  if (ms - lastUpdate > interval) {
    lastUpdate = ms;
    uint8_t* heats[4] = {heat1, heat2, heat3, heat4};
    for (uint8_t p = 0; p < 4; p++) {
      uint8_t* h = heats[p];
      for (uint8_t i = 0; i < PANEL_LEDS; i++) {
        h[i] = qsub8(h[i], random8(0, 40));
      }
      for (int i = PANEL_LEDS - 1; i >= 2; i--) {
        h[i] = (h[i - 1] + h[i - 2] + h[i - 2]) / 3;
      }
      if (random8() < 120) {
        uint8_t y = random8(0, 3);
        h[y] = qadd8(h[y], random8(160, 255));
      }
    }
  }
  for (uint8_t i = 0; i < PANEL_LEDS; i++) {
    leds1[i] = HeatColor(heat1[i]);
    leds2[i] = HeatColor(heat2[i]);
    leds3[i] = HeatColor(heat3[i]);
    leds4[i] = HeatColor(heat4[i]);
  }
}

static void renderSparkle(uint32_t ms) {
  fadeToBlackBy(leds1, PANEL_LEDS, 15);
  fadeToBlackBy(leds2, PANEL_LEDS, 15);
  fadeToBlackBy(leds3, PANEL_LEDS, 15);
  fadeToBlackBy(leds4, PANEL_LEDS, 15);
  static uint32_t lastSpark = 0;
  uint16_t interval = S.speed / 50; if (interval < 20) interval = 20;
  if (ms - lastSpark > interval) {
    lastSpark = ms;
    leds1[random8(PANEL_LEDS)] = CHSV(S.hue + random8(0, 32), S.sat, 255);
    leds2[random8(PANEL_LEDS)] = CHSV(S.hue + random8(0, 32), S.sat, 255);
    leds3[random8(PANEL_LEDS)] = CHSV(S.hue + random8(0, 32), S.sat, 255);
    leds4[random8(PANEL_LEDS)] = CHSV(S.hue + random8(0, 32), S.sat, 255);
  }
}

// Wipe — 2-colour boundary sweeps left→right across the panel row, then reverses.
static void renderWipe(uint32_t ms) {
  CRGB cA = CHSV(S.hue,       S.sat, 255);
  CRGB cB = CHSV(S.hue + 128, S.sat, 255);
  // Split the cycle in two halves: forward sweep then reverse.
  uint32_t phase = (uint32_t)(ms % S.speed) * 512UL / S.speed;
  uint8_t half = phase >> 8;                  // 0 or 1
  uint8_t sweep = phase & 0xFF;               // 0..255 within the half
  CRGB* panels[4] = {leds1, leds2, leds3, leds4};
  for (uint8_t i = 0; i < 4; i++) {
    uint8_t threshold = i * 64 + 32;          // panel centre in 0..255
    bool crossed = sweep > threshold;
    CRGB fill = half ? (crossed ? cA : cB) : (crossed ? cB : cA);
    fill_solid(panels[i], PANEL_LEDS, fill);
  }
}

static void renderBreathe(uint32_t ms) {
  uint16_t phase = (uint32_t)(ms % S.speed) * 65536UL / S.speed;
  uint8_t wave = sin8(phase >> 8);
  uint8_t v    = ease8InOutQuad(wave);
  CRGB c = CHSV(S.hue, S.sat, v);
  fill_solid(leds1, PANEL_LEDS, c);
  fill_solid(leds2, PANEL_LEDS, c);
  fill_solid(leds3, PANEL_LEDS, c);
  fill_solid(leds4, PANEL_LEDS, c);
}

// ─── Boot / Loop ─────────────────────────────────────────────────────────
void setup() {
  Serial.setRxBufferSize(1024);  // accommodate ~390-byte frame: lines
  Serial.begin(115200);
  WiFi.mode(WIFI_OFF);
  WiFi.forceSleepBegin();
  delay(300);

  FastLED.addLeds<LED_TYPE, LED_PIN_1, COLOR_ORDER>(leds1, PANEL_LEDS)
    .setCorrection(TypicalLEDStrip);
  FastLED.addLeds<LED_TYPE, LED_PIN_2, COLOR_ORDER>(leds2, PANEL_LEDS)
    .setCorrection(TypicalLEDStrip);
  FastLED.addLeds<LED_TYPE, LED_PIN_3, COLOR_ORDER>(leds3, PANEL_LEDS)
    .setCorrection(TypicalLEDStrip);
  FastLED.addLeds<LED_TYPE, LED_PIN_4, COLOR_ORDER>(leds4, PANEL_LEDS)
    .setCorrection(TypicalLEDStrip);
  FastLED.setBrightness(S.bri);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, 2500);
  FastLED.clear(true);

  Serial.println(F("ready"));
}

void loop() {
  pollSerial();
  uint32_t ms = millis();

  // While the host is streaming frames, skip mode rendering — the streamed
  // colors live in leds1..leds4 already and just need to be shown.
  bool streaming = (ms - lastStreamMs) < STREAM_OVERRIDE_MS;
  if (!streaming) {
    switch (S.mode) {
      case MODE_INFINITY: renderInfinity(ms); break;
      case MODE_SOLID:    renderSolid(ms);    break;
      case MODE_PULSE:    renderPulse(ms);    break;
      case MODE_RAINBOW:  renderRainbow(ms);  break;
      case MODE_COMET:    renderComet(ms);    break;
      case MODE_THEATER:  renderTheater(ms);  break;
      case MODE_FIRE:     renderFire(ms);     break;
      case MODE_SPARKLE:  renderSparkle(ms);  break;
      case MODE_WIPE:     renderWipe(ms);     break;
      case MODE_BREATHE:  renderBreathe(ms);  break;
      default: break;
    }
  }

  FastLED.show();
  FastLED.delay(16);
}
