#include "wifi_provision.h"
#include "board_config.h"
#include <WiFi.h>
#include <Preferences.h>
#include <WebServer.h>
#include <DNSServer.h>

// Arduino-ESP32 3.x 는 esp_eap_client, 2.x 는 esp_wpa2 를 쓴다.
#if __has_include(<esp_eap_client.h>)
  #include <esp_eap_client.h>
  #define BMO_EAP_NEW_API 1
#else
  #include <esp_wpa2.h>
  #define BMO_EAP_NEW_API 0
#endif

static Preferences prefs;
static WebServer   server(80);
static DNSServer   dns;

void Provisioning::load() {
    prefs.begin("bmo", true);
    cfg.wifiMode    = prefs.getUChar("wmode", 0);
    cfg.ssid        = prefs.getString("ssid", "");
    cfg.psk         = prefs.getString("psk", "");
    cfg.eapIdentity = prefs.getString("eapid", "");
    cfg.eapUser     = prefs.getString("eapuser", "");
    cfg.eapPass     = prefs.getString("eappass", "");
    cfg.mqttHost    = prefs.getString("mhost", "");
    cfg.mqttPort    = prefs.getUShort("mport", 8883);
    cfg.mqttUser    = prefs.getString("muser", "");
    cfg.mqttPass    = prefs.getString("mpass", "");
    cfg.deviceId    = prefs.getString("devid", "bmo1");
    prefs.end();
}

void Provisioning::save() {
    prefs.begin("bmo", false);
    prefs.putUChar ("wmode",   cfg.wifiMode);
    prefs.putString("ssid",    cfg.ssid);
    prefs.putString("psk",     cfg.psk);
    prefs.putString("eapid",   cfg.eapIdentity);
    prefs.putString("eapuser", cfg.eapUser);
    prefs.putString("eappass", cfg.eapPass);
    prefs.putString("mhost",   cfg.mqttHost);
    prefs.putUShort("mport",   cfg.mqttPort);
    prefs.putString("muser",   cfg.mqttUser);
    prefs.putString("mpass",   cfg.mqttPass);
    prefs.putString("devid",   cfg.deviceId);
    prefs.end();
}

void Provisioning::begin() { load(); }

bool Provisioning::connectWifi(uint32_t timeoutMs) {
    if (cfg.ssid.isEmpty()) return false;

    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);                 // 응답성이 중요하고 USB 상시 전원이라 절전 불필요
    WiFi.disconnect(true);
    delay(100);

    if (cfg.wifiMode == 1) {
        // --- WPA2-Enterprise (PEAP / MSCHAPv2) ---
        // 학교에 따라 CA 인증서를 요구하기도 한다. 그 경우 아래에
        // esp_eap_client_set_ca_cert() 로 인증서를 넣어야 한다.
#if BMO_EAP_NEW_API
        esp_eap_client_set_identity((uint8_t*)cfg.eapIdentity.c_str(), cfg.eapIdentity.length());
        esp_eap_client_set_username((uint8_t*)cfg.eapUser.c_str(),     cfg.eapUser.length());
        esp_eap_client_set_password((uint8_t*)cfg.eapPass.c_str(),     cfg.eapPass.length());
        esp_wifi_sta_enterprise_enable();
#else
        esp_wifi_sta_wpa2_ent_set_identity((uint8_t*)cfg.eapIdentity.c_str(), cfg.eapIdentity.length());
        esp_wifi_sta_wpa2_ent_set_username((uint8_t*)cfg.eapUser.c_str(),     cfg.eapUser.length());
        esp_wifi_sta_wpa2_ent_set_password((uint8_t*)cfg.eapPass.c_str(),     cfg.eapPass.length());
        esp_wifi_sta_wpa2_ent_enable();
#endif
        WiFi.begin(cfg.ssid.c_str());
    } else {
        WiFi.begin(cfg.ssid.c_str(), cfg.psk.c_str());
    }

    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeoutMs) {
        delay(200);
    }
    return WiFi.status() == WL_CONNECTED;
}

// ---------------------------------------------------------------------------
// 설정 포털
// ---------------------------------------------------------------------------
static String portalPage(const BmoConfig& c) {
    String h = F("<!doctype html><meta charset=utf-8>"
                 "<meta name=viewport content='width=device-width,initial-scale=1'>"
                 "<title>BMO setup</title><style>"
                 "body{font-family:system-ui;background:#123;color:#eee;margin:0;padding:20px}"
                 "h1{color:#5fe0bb;font-size:20px}label{display:block;margin:12px 0 4px;font-size:13px}"
                 "input,select{width:100%;padding:10px;border-radius:8px;border:1px solid #456;"
                 "background:#0d1b26;color:#eee;box-sizing:border-box}"
                 "button{margin-top:20px;width:100%;padding:14px;border:0;border-radius:8px;"
                 "background:#5fe0bb;color:#03231a;font-weight:700;font-size:16px}"
                 "</style><h1>BMO 설정</h1><form method=POST action=/save>");

    h += F("<label>WiFi 종류</label><select name=wmode>");
    h += String(F("<option value=0")) + (c.wifiMode == 0 ? " selected" : "") + F(">일반 WiFi (비밀번호)</option>");
    h += String(F("<option value=1")) + (c.wifiMode == 1 ? " selected" : "") + F(">학교 WiFi (계정 로그인)</option></select>");

    h += F("<label>WiFi 이름 (SSID)</label><input name=ssid value='");   h += c.ssid;        h += F("'>");
    h += F("<label>비밀번호 (일반 WiFi 용)</label><input name=psk type=password value=''>");
    h += F("<label>계정 ID (학교 WiFi 용)</label><input name=eapuser value='"); h += c.eapUser; h += F("'>");
    h += F("<label>계정 비밀번호</label><input name=eappass type=password value=''>");
    h += F("<label>MQTT 주소</label><input name=mhost value='");          h += c.mqttHost;    h += F("'>");
    h += F("<label>MQTT 포트</label><input name=mport value='");          h += c.mqttPort;    h += F("'>");
    h += F("<label>MQTT 사용자</label><input name=muser value='");        h += c.mqttUser;    h += F("'>");
    h += F("<label>MQTT 비밀번호</label><input name=mpass type=password value=''>");
    h += F("<label>기기 이름</label><input name=devid value='");          h += c.deviceId;    h += F("'>");
    h += F("<button type=submit>저장하고 다시 시작</button></form>"
           "<p style='font-size:12px;color:#89a'>비밀번호는 이 기기 안에만 저장됩니다.</p>");
    return h;
}

void Provisioning::startPortal() {
    WiFi.mode(WIFI_AP);
    WiFi.softAP(SETUP_AP_SSID, SETUP_AP_PASSWORD);
    dns.start(53, "*", WiFi.softAPIP());     // 어떤 주소를 쳐도 설정 화면이 뜨게

    server.on("/", HTTP_GET, [this]() { server.send(200, "text/html", portalPage(cfg)); });

    server.on("/save", HTTP_POST, [this]() {
        cfg.wifiMode = server.arg("wmode").toInt();
        cfg.ssid     = server.arg("ssid");
        cfg.mqttHost = server.arg("mhost");
        cfg.mqttPort = server.arg("mport").toInt();
        cfg.mqttUser = server.arg("muser");
        cfg.deviceId = server.arg("devid");
        cfg.eapUser  = server.arg("eapuser");
        cfg.eapIdentity = cfg.eapUser;       // 대개 익명 ID = 계정 ID 로 충분하다

        // 비밀번호 칸은 비워 두면 기존 값을 유지한다 (재입력 실수 방지)
        if (server.arg("psk").length())     cfg.psk     = server.arg("psk");
        if (server.arg("eappass").length()) cfg.eapPass = server.arg("eappass");
        if (server.arg("mpass").length())   cfg.mqttPass = server.arg("mpass");

        save();
        server.send(200, "text/html",
                    "<meta charset=utf-8><body style='font-family:system-ui;background:#123;color:#5fe0bb;padding:40px'>"
                    "저장했습니다. BMO를 다시 시작합니다.");
        delay(800);
        ESP.restart();
    });

    server.onNotFound([this]() { server.send(200, "text/html", portalPage(cfg)); });
    server.begin();
    _portalActive = true;
}

void Provisioning::handlePortal() {
    if (!_portalActive) return;
    dns.processNextRequest();
    server.handleClient();
}
