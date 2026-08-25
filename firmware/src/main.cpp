// ---------------------------------------------------------------------------
// BMO 원격 조종 피규어 — 메인
//
//   [브라우저 웹앱] --MQTT/WSS--> [브로커] --MQTT/TLS--> [BMO]
//
// 얼굴은 64x32 논리 캔버스에 파라미터로 그리고(animator), 패널에 정수배로 확대해
// 밀어 넣는다(renderer). 케이스의 얼굴 창은 스모크 아크릴로 덮여 있어서
// 꺼진 픽셀과 화면 바깥 여백이 똑같이 까맣게 보인다.
// ---------------------------------------------------------------------------
#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>

#include "board_config.h"
#include "face_config.h"
#include "face/display.h"
#include "face/renderer.h"
#include "face/animator.h"
#include "arm/servo_arm.h"
#include "ui/buttons.h"
#include "net/wifi_provision.h"
#include "net/mqtt_client.h"
#include "net/codec.h"

static BmoDisplay   lcd;
static Renderer     renderer;
static Animator     animator;
static ServoArm     arm;
static Buttons      buttons;
static Provisioning prov;
static MqttClient   mqttc;

static uint8_t  incoming[FACE_PIXELS];
static bool     sleeping = false;
static uint32_t lastStatePublish = 0;
static uint32_t lastFrame = 0;

static const uint32_t FRAME_INTERVAL_MS = 33;    // 약 30fps
static const uint32_t STATE_INTERVAL_MS = 15000;

// ---------------------------------------------------------------------------
static void applySleep(bool on) {
    sleeping = on;
    animator.setSleeping(on);
    renderer.setBrightness(on ? 8 : DEFAULT_BRIGHTNESS);
    if (on) arm.preset("down");
}

static void publishState() {
    JsonDocument doc;
    doc["expression"] = animator.expressionName();
    doc["arm"]        = arm.angle();
    doc["armPreset"]  = arm.lastPreset();
    doc["sleeping"]   = sleeping;
    doc["brightness"] = renderer.brightness();
    doc["rssi"]       = WiFi.RSSI();
    doc["ip"]         = WiFi.localIP().toString();
    doc["uptime"]     = millis() / 1000;
    doc["heap"]       = ESP.getFreeHeap();

    String out;
    serializeJson(doc, out);
    mqttc.publishState(out);
}

// 웹앱이 보낸 명령. 토픽의 마지막 조각(face/text/arm/sys)으로 갈라진다.
static void onCommand(const String& sub, const String& payload) {
    JsonDocument doc;
    if (deserializeJson(doc, payload)) {
        Serial.printf("[cmd] JSON 파싱 실패: %s\n", sub.c_str());
        return;
    }

    if (sub == "face") {
        if (doc["bitmap"].is<const char*>()) {
            // 직접 그린 그림 또는 한글 글씨(웹앱이 미리 도트로 만들어 보낸다)
            if (decodeFaceBitmap(doc["bitmap"].as<const char*>(), incoming, FACE_PIXELS)) {
                if (sleeping) applySleep(false);
                animator.showBitmap(incoming);
            } else {
                Serial.println("[cmd] 비트맵 디코드 실패");
            }
        } else if (doc["preset"].is<const char*>()) {
            if (sleeping) applySleep(false);
            if (!animator.setExpression(doc["preset"].as<const char*>())) Serial.println("[cmd] 모르는 표정");
        }
    } else if (sub == "arm") {
        if (sleeping) applySleep(false);
        if (doc["preset"].is<const char*>())   arm.preset(doc["preset"].as<const char*>());
        else if (doc["angle"].is<int>())       arm.moveTo(doc["angle"].as<int>());
    } else if (sub == "sys") {
        if (doc["sleep"].is<bool>())      applySleep(doc["sleep"].as<bool>());
        if (doc["brightness"].is<int>())  renderer.setBrightness(doc["brightness"].as<int>());
    }
    publishState();
}

// ---------------------------------------------------------------------------
static void showStatusScreen() {
    char l1[22], l2[22], l3[22];
    bool wifiOk = (WiFi.status() == WL_CONNECTED);
    snprintf(l1, sizeof(l1), "WIFI %s", wifiOk ? "OK" : "NO");
    if (wifiOk) snprintf(l2, sizeof(l2), "%d DBM", (int)WiFi.RSSI());
    else        snprintf(l2, sizeof(l2), "-");
    snprintf(l3, sizeof(l3), "MQTT %s", mqttc.connected() ? "OK" : "NO");
    animator.showStatus(l1, l2, l3, 3000);
}

void setup() {
    Serial.begin(115200);
    randomSeed(esp_random());

    lcd.init();
    lcd.setRotation(0);
    renderer.begin(&lcd);
    animator.begin(&renderer);
    animator.render();
    renderer.push();

    arm.begin();
    buttons.begin();
    prov.begin();

    if (!prov.cfg.valid() || !prov.connectWifi()) {
        // 접속 정보가 없거나 붙지 못하면 설정 포털을 띄운다.
        // 학교 WiFi 는 계정/인증서 정책이 제각각이라 이 경로가 실제로 자주 쓰인다.
        animator.showStatus("SETUP", SETUP_AP_SSID, "WIFI", 60000);
        prov.startPortal();
        return;
    }

    mqttc.begin(prov.cfg.mqttHost, prov.cfg.mqttPort,
                prov.cfg.mqttUser, prov.cfg.mqttPass,
                prov.cfg.deviceId, onCommand);
    animator.setExpression("happy");
}

void loop() {
    uint32_t now = millis();

    if (prov.portalActive()) {
        prov.handlePortal();
        if (now - lastFrame >= FRAME_INTERVAL_MS) {
            lastFrame = now;
            animator.update(now);
            animator.render();
            renderer.push();
        }
        return;
    }

    switch (buttons.poll(now)) {
        case BTN_GREEN_SHORT: applySleep(!sleeping); publishState(); break;
        case BTN_BLUE_SHORT:  showStatusScreen(); break;
        case BTN_BLUE_LONG:   prov.startPortal();
                              animator.showStatus("SETUP", SETUP_AP_SSID, "WIFI", 60000);
                              break;
        default: break;
    }

    arm.update(now);
    mqttc.loop(now);

    if (now - lastStatePublish >= STATE_INTERVAL_MS) {
        lastStatePublish = now;
        publishState();
    }

    if (now - lastFrame >= FRAME_INTERVAL_MS) {
        lastFrame = now;
        animator.update(now);
        animator.render();
        renderer.push();
    }
}
