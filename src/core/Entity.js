/**
 * ============================================================================
 *  Entity — 실험 도구 하나의 "데이터 컨테이너"
 * ============================================================================
 *
 *  Entity-Component 구조에서 Entity는 **행동을 갖지 않는다**. 행동(메시 생성,
 *  물리 생성, 매 프레임 갱신)은 ToolRegistry에 등록된 "도구 정의(ToolDefinition)"
 *  가 담당하고, Entity는 아래 6개 컴포넌트만 들고 다닌다.
 *
 *   ┌─────────────────┬───────────────────────────────────────────────────────┐
 *   │ physicsDomain   │ ["mechanical"], ["optical"], ["optical","thermal"] …   │
 *   │                 │ → 공간 판정(broad phase) 전략 선택의 키               │
 *   │ transform       │ { position: Vector3, quaternion: Quaternion } (월드)   │
 *   │ properties      │ 도메인별 물리 파라미터 (예: 도르래 {radius, friction}) │
 *   │                 │ → 범용 설정 패널이 이 객체의 키를 순회해 UI 자동 생성  │
 *   │ interactionPorts│ 다른 도구와 만나는 "접점" (로컬 좌표로 저장,           │
 *   │                 │   getWorldPort()로 월드 좌표 변환)                     │
 *   │ mesh            │ Three.js Object3D 루트                                │
 *   │ collider        │ Rapier 참조 묶음 { body, bodies[], colliders[],       │
 *   │                 │   joints[], sensor }                                   │
 *   └─────────────────┴───────────────────────────────────────────────────────┘
 *
 *  `type`(예: "laser")은 narrow phase에서 InteractionRegistry를 조회하는 키다.
 *  `state`는 도구 정의가 자유롭게 쓰는 런타임 상태(각도, 빔 결과 등)이다.
 */
import * as THREE from 'three';

let nextId = 1;

export class Entity {
  /**
   * @param {object} def         ToolRegistry의 도구 정의
   * @param {object} [properties] 초기 properties (없으면 def.defaultProperties 복제)
   */
  constructor(def, properties) {
    this.id = nextId++;
    this.type = def.type;
    this.def = def;

    // ── 컴포넌트 ────────────────────────────────────────────────
    this.physicsDomain = [...def.physicsDomain];
    this.transform = {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
    };
    this.properties = structuredClone(properties ?? def.defaultProperties);
    this.interactionPorts = [];
    this.refreshPorts();
    this.mesh = null;
    this.collider = null;

    /** 도구 정의가 쓰는 런타임 상태 */
    this.state = {};
  }

  /**
   * 포트 목록을 (다시) 만든다. def.interactionPorts 가 함수면 properties 에 따라 달라지는 포트
   * (예: 광선 상자의 광선 수) → 속성이 바뀌어 재생성될 때 EntityManager 가 호출한다.
   */
  refreshPorts() {
    const src = typeof this.def.interactionPorts === 'function'
      ? this.def.interactionPorts(this.properties)
      : this.def.interactionPorts ?? [];
    this.interactionPorts = src.map((p) => ({
      name: p.name,
      type: p.type,                                   // 예: "beam_output", "beam_input", "rope_attach"
      origin: new THREE.Vector3(...p.origin),         // 로컬 좌표
      direction: new THREE.Vector3(...p.direction).normalize(),
      active: true,                                   // 도구가 끌 수 있음 (레이저 OFF 등)
    }));
  }

  /** 수평 회전각(yaw, 라디안) — 로컬 +Z(정면)가 월드 +Z에서 돌아간 각 */
  get yaw() {
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(this.transform.quaternion);
    return Math.atan2(f.x, f.z);
  }

  get label() {
    return `${this.def.label}#${this.id}`;
  }

  /** 포트를 월드 좌표로 변환해 반환한다 (origin, direction 모두 새 벡터). */
  getWorldPort(name) {
    const port = this.interactionPorts.find((p) => p.name === name);
    if (!port) return null;
    return this.toWorldPort(port);
  }

  toWorldPort(port) {
    const { position, quaternion } = this.transform;
    return {
      name: port.name,
      type: port.type,
      active: port.active,
      origin: port.origin.clone().applyQuaternion(quaternion).add(position),
      direction: port.direction.clone().applyQuaternion(quaternion),
    };
  }

  /** 특정 타입의 포트를 모두 월드 좌표로 */
  worldPortsOfType(type) {
    return this.interactionPorts.filter((p) => p.type === type).map((p) => this.toWorldPort(p));
  }

  hasDomain(domain) {
    return this.physicsDomain.includes(domain);
  }
}
