#pragma once
#include <Arduino.h>
#include <functional>

// 브로커를 거치는 이유: 기숙사 WiFi는 NAT/방화벽 뒤라 밖에서 직접 접속할 수 없다.
// BMO 가 밖으로 연결을 열어두면 방화벽을 건드릴 필요가 없다.
class MqttClient {
public:
    using CmdHandler = std::function<void(const String& sub, const String& payload)>;

    void begin(const String& host, uint16_t port,
               const String& user, const String& pass,
               const String& deviceId, CmdHandler onCmd);
    void loop(uint32_t now);
    bool connected() const;
    void publishState(const String& json);
    const char* deviceId() const { return _deviceId.c_str(); }

    // 내부 콜백에서만 호출한다 (토픽 마지막 조각 + 본문)
    void handleIncoming(const String& sub, const String& payload) { if (_onCmd) _onCmd(sub, payload); }

private:
    bool connect();

    String   _host, _user, _pass, _deviceId;
    uint16_t _port = 8883;
    CmdHandler _onCmd;
    uint32_t _nextAttempt = 0;
    uint32_t _backoffMs   = 2000;   // 실패할수록 늘어난다 (최대 60초)
};
