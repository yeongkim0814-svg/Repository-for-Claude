/**
 * ============================================================================
 *  ToolRegistry — 도구 "종류"의 카탈로그
 * ============================================================================
 *
 *  새 도구를 추가하는 방법 = 도구 정의 객체 하나를 만들어 ToolRegistry.define() 한다.
 *  찬장 UI, 배치 고스트, 설정 패널, 물리 생성, 상호작용 엔진은 모두 이 정의만 보고
 *  동작하므로 **다른 파일을 수정할 필요가 없다.**
 *
 *  ToolDefinition 인터페이스 (★ = 필수)
 *  ─────────────────────────────────────────────────────────────────────────
 *  ★ type              : string   InteractionRegistry 조회 키 ("laser", "slit" …)
 *  ★ label, icon       : string   찬장 UI 표시용
 *    description       : string
 *  ★ physicsDomain     : string[] ["mechanical"] / ["optical"] …
 *  ★ defaultProperties : object   숫자·불리언·문자열 값 → 설정 패널 자동 생성
 *    propertyMeta      : { [key]: { label, min, max, step, unit, rebuild } }
 *                        rebuild:false 이면 값 변경 시 메시/물리를 재생성하지 않음
 *    interactionPorts  : [{ name, type, origin:[x,y,z], direction:[x,y,z] }] (로컬)
 *  ★ footprint(props)  : → {x,y,z} 반(半)크기. 배치 가능 판정과 근접 센서에 사용.
 *                        로컬 원점 = 바닥면 중앙, +Y 위, +Z "정면"(레이저 방향)
 *  ★ buildMesh(props)  : → THREE.Object3D (실제 메시·고스트·손에 든 모습 공용)
 *    createPhysics(entity, ctx, anchorBody) : 추가 바디/조인트 생성 →
 *                        { bodies?, colliders?, joints? } 반환
 *    onSpawn(entity, ctx)                 : 배치 직후 초기화
 *    fixedUpdate(entity, dt, ctx, phase)  : 물리 스텝 전('pre')/후('post')
 *    update(entity, dt, ctx)              : 렌더 프레임마다 (시각 갱신)
 *    onPropertyChange(entity, key, ctx)   : rebuild:false 속성 변경 시
 *    readouts(entity)  : → { 라벨: 문자열 } 설정 패널에 실시간 측정값 표시
 *    actions           : { key: { label, run(entity, ctx) } } 패널 버튼
 */
const definitions = new Map();

export const ToolRegistry = {
  define(def) {
    for (const k of ['type', 'label', 'physicsDomain', 'defaultProperties', 'footprint', 'buildMesh']) {
      if (def[k] === undefined) throw new Error(`ToolDefinition "${def.type}"에 ${k}가 없습니다.`);
    }
    if (definitions.has(def.type)) throw new Error(`도구 타입 중복: ${def.type}`);
    definitions.set(def.type, def);
    return def;
  },
  get(type) {
    return definitions.get(type);
  },
  all() {
    return [...definitions.values()];
  },
};
