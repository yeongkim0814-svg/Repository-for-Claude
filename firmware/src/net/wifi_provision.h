#pragma once
#include <stdint.h>
#include <Arduino.h>

// 기숙사 WiFi 가 WPA2-Enterprise(학교 계정) 라서, 접속 정보를 코드에 넣지 않는다.
// 대신 BMO가 스스로 설정용 WiFi(BMO-setup)를 띄우고, 폰으로 접속해 입력받는다.
// 입력값은 NVS 에만 저장되며 깃허브에는 올라가지 않는다.
struct BmoConfig {
    uint8_t wifiMode = 0;          // 0 = 일반 WPA2(PSK), 1 = WPA2-Enterprise
    String  ssid;
    String  psk;                   // PSK 모드에서만 사용
    String  eapIdentity;           // Enterprise: 익명 ID (보통 계정과 동일)
    String  eapUser;
    String  eapPass;
    String  mqttHost;
    uint16_t mqttPort = 8883;
    String  mqttUser;
    String  mqttPass;
    String  deviceId = "bmo1";
    bool valid() const { return ssid.length() > 0 && mqttHost.length() > 0; }
};

class Provisioning {
public:
    void begin();
    bool connectWifi(uint32_t timeoutMs = 25000);
    void startPortal();               // 설정 AP + 캡티브 포털 (블로킹 아님)
    void handlePortal();              // 포털이 떠 있는 동안 루프에서 호출
    bool portalActive() const { return _portalActive; }
    void save();

    BmoConfig cfg;

private:
    void load();
    bool _portalActive = false;
};
