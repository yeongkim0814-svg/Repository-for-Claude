#include "mqtt_client.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

static WiFiClientSecure  netClient;
static PubSubClient      mqtt(netClient);
static MqttClient*       self = nullptr;

void MqttClient::begin(const String& host, uint16_t port,
                       const String& user, const String& pass,
                       const String& deviceId, CmdHandler onCmd) {
    _host = host; _port = port; _user = user; _pass = pass;
    _deviceId = deviceId; _onCmd = onCmd;
    self = this;

    // 웹앱이 보내는 그림(base64 RLE)은 기본 버퍼(256B)를 넘는다
    mqtt.setBufferSize(8192);
    mqtt.setKeepAlive(30);
    mqtt.setServer(_host.c_str(), _port);
    mqtt.setCallback([](char* topic, uint8_t* payload, unsigned int len) {
        if (!self) return;
        String t(topic);
        int slash = t.lastIndexOf('/');
        String sub = (slash >= 0) ? t.substring(slash + 1) : t;
        String body;
        body.reserve(len + 1);
        for (unsigned int i = 0; i < len; ++i) body += (char)payload[i];
        self->handleIncoming(sub, body);
    });

    // 서버 인증서 검증을 끄고 암호화만 사용한다. 통신 내용은 보호되지만
    // 브로커 위장까지 막으려면 아래를 netClient.setCACert(ROOT_CA) 로 바꾼다.
    netClient.setInsecure();
}

bool MqttClient::connected() const { return mqtt.connected(); }

bool MqttClient::connect() {
    String clientId = "bmo-" + _deviceId + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    String statusTopic = "bmo/" + _deviceId + "/status";

    // LWT: 전원이 끊기거나 연결이 죽으면 브로커가 대신 offline 을 알려준다
    bool ok = mqtt.connect(clientId.c_str(), _user.c_str(), _pass.c_str(),
                           statusTopic.c_str(), 1, true, "offline");
    if (!ok) return false;

    mqtt.publish(statusTopic.c_str(), "online", true);
    mqtt.subscribe(("bmo/" + _deviceId + "/cmd/#").c_str(), 1);
    return true;
}

void MqttClient::loop(uint32_t now) {
    if (WiFi.status() != WL_CONNECTED) return;

    if (!mqtt.connected()) {
        if (now < _nextAttempt) return;
        if (connect()) {
            _backoffMs = 2000;
        } else {
            _nextAttempt = now + _backoffMs;
            _backoffMs = (_backoffMs < 60000) ? _backoffMs * 2 : 60000;
        }
        return;
    }
    mqtt.loop();
}

void MqttClient::publishState(const String& json) {
    if (json.length() && mqtt.connected())
        mqtt.publish(("bmo/" + _deviceId + "/state").c_str(), json.c_str(), true);
}
