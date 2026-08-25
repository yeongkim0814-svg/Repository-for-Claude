#pragma once
#include <stdint.h>
#include "renderer.h"

// 표정은 비트맵 묶음이 아니라 "파라미터"로 들고 있는다.
// 그래야 표정 사이를 부드럽게 보간할 수 있고, 아이들 모션(깜빡임/시선/호흡)을
// 표정 위에 겹쳐 얹을 수 있다. 자연스러움은 해상도가 아니라 여기서 나온다.
enum MouthShape : uint8_t {
    MOUTH_SMILE, MOUTH_FLAT, MOUTH_OPEN, MOUTH_SMALL_O,
    MOUTH_WAVY,  MOUTH_GRIN, MOUTH_CAT
};

struct FaceParams {
    float eyeOpenL;     // 0 = 완전히 감김, 1 = 완전히 뜸
    float eyeOpenR;
    float eyeCurve;     // >0 이면 눈이 웃는 아치(^^) 모양이 된다
    float pupilX;       // -1 ~ 1 (시선)
    float pupilY;
    float mouthW;       // 입 크기 배율
    float mouthH;
    uint8_t mouth;
    float blush;        // 0 = 없음, 1 = 진하게
    float browTilt;     // -1 = 화남, +1 = 슬픔 (0이면 눈썹 없음)

    // 멤버 기본값을 두면(예: float eyeOpenL = 1.0f) 컴파일러가 C++11 표준일 때
    // 중괄호 초기화 {1,1,0,...} 가 aggregate-init 로 안 먹는 경우가 있어서
    // (실제로 ESP32 툴체인에서 발생), 생성자로 기본값을 명시한다.
    FaceParams(float eyeOpenL_ = 1.0f, float eyeOpenR_ = 1.0f, float eyeCurve_ = 0.0f,
               float pupilX_ = 0.0f, float pupilY_ = 0.0f, float mouthW_ = 1.0f,
               float mouthH_ = 1.0f, uint8_t mouth_ = MOUTH_SMILE, float blush_ = 0.0f,
               float browTilt_ = 0.0f)
        : eyeOpenL(eyeOpenL_), eyeOpenR(eyeOpenR_), eyeCurve(eyeCurve_),
          pupilX(pupilX_), pupilY(pupilY_), mouthW(mouthW_), mouthH(mouthH_),
          mouth(mouth_), blush(blush_), browTilt(browTilt_) {}
};

enum FaceMode : uint8_t { MODE_FACE, MODE_BITMAP, MODE_STATUS };

class Animator {
public:
    void begin(Renderer* r);
    void update(uint32_t now);          // 매 루프 호출
    void render();                      // 논리 캔버스에 현재 프레임을 그린다

    // --- 외부 명령 ---
    bool setExpression(const char* name);          // 프리셋 이름으로 전환
    void showBitmap(const uint8_t* pixels);        // 웹앱이 보낸 그림/글씨
    void showStatus(const char* l1, const char* l2, const char* l3, uint32_t ms);
    void setSleeping(bool on);
    bool sleeping() const { return _sleeping; }
    const char* expressionName() const { return _exprName; }

    static const char* const* presetNames(int& count);

private:
    void   applyIdle(uint32_t now, FaceParams& p);
    void   drawFace(const FaceParams& p);
    void   drawArc(int cx, int cy, int w, int h, int dir, uint8_t color);

    Renderer* _r = nullptr;
    FaceParams _from, _to, _cur;
    float    _blend = 1.0f;             // 표정 전환 진행도 (0~1)
    uint32_t _lastMs = 0;
    char     _exprName[16] = "neutral";

    FaceMode _mode = MODE_FACE;
    uint8_t  _bitmap[FACE_PIXELS];
    char     _status[3][22] = {{0},{0},{0}};
    uint32_t _statusUntil = 0;

    // 아이들 모션 상태
    uint32_t _nextBlink = 0;   float _blinkPhase = -1.0f;  uint8_t _blinkBurst = 0;
    uint32_t _nextSaccade = 0; float _gazeX = 0, _gazeY = 0, _gazeTargetX = 0, _gazeTargetY = 0;
    uint32_t _nextYawn = 0;    float _yawnPhase = -1.0f;
    bool     _sleeping = false; float _sleepPhase = 0.0f;
    float    _breathe = 0.0f;
};
