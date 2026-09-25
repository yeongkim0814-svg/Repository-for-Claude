/**
 * ============================================================================
 *  OpticalSystem — 광학 도메인 솔버 (기하광학 광선 추적)
 * ============================================================================
 *
 *  역학에서 Rapier가 "접촉·충돌의 물리"를 푸는 것처럼, 광학에서는 이 클래스가
 *  "빛이 어디로 가는가"를 푼다. 매 프레임:
 *
 *   1. 광원(def.optics.emit이 있는 도구: 레이저, 광선 상자)이 광선을 내보낸다.
 *   2. 각 광선을 Three.js Raycaster로 쏘아 처음 닿는 물체를 찾는다.
 *   3. 닿은 물체의 def.optics.respond(entity, ray, hit)를 호출 →
 *        거울: 반사광 1개 / 렌즈: 꺾인 광선 1개 / 유리: 굴절광 + 부분 반사광 …
 *        respond가 없으면 = 불투명 = 흡수 (기본값. 특별 처리 없음)
 *   4. 새 광선들로 2~3 반복 (최대 깊이 MAX_DEPTH, 세기가 MIN_POWER 이하면 중단)
 *
 *  ── 왜 반사·굴절은 InteractionRegistry 규칙이 아닌가? ────────────────────────
 *   반사는 "거울과 들어온 빛"만으로 결정된다. 빛을 낸 게 레이저든 광선 상자든 다른
 *   거울이든 상관없다. 이것을 ('laser','mirror') 규칙으로 만들면 ('raybox','mirror'),
 *   ('mirror','mirror'), ('lens','mirror') … 모든 조합을 등록해야 하는 N² 폭발이 생긴다.
 *   → 한 소자의 응답으로 정의되는 것  = 소자의 optics.respond (도메인 솔버)
 *   → 두 도구의 조합으로만 생기는 현상 = InteractionRegistry (예: 슬릿 + 스크린 → 회절 무늬)
 *
 *  ── broad phase에 주는 정보: "광학적 연결" ──────────────────────────────────
 *   광선은 지나온 소자 목록(history)과 누적 광로 길이를 들고 다닌다. 광선이 B에 닿으면
 *   history의 모든 A에 대해 (A → B, 광로 길이 L) 연결을 기록한다.
 *   예) 레이저 → 슬릿 → 거울 → 스크린 이면 (슬릿, 스크린) 연결의 L = 슬릿~거울~스크린 거리.
 *   그래서 슬릿과 스크린 사이에 거울을 넣어도 회절 무늬 규칙이 그대로 동작하고,
 *   무늬 크기(∝ L)도 꺾인 경로 전체 길이로 정확히 계산된다.
 */
import * as THREE from 'three';
import { wavelengthToColor } from './wavelengthColor.js';

const MAX_DEPTH = 24;
const MIN_POWER = 1e-5;      // W. 이보다 약한 광선은 추적 중단
const MAX_DIST = 30;
const pairKey = (a, b) => `${a.id}>${b.id}`;

export class OpticalSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.raycaster = new THREE.Raycaster();
    /** 이번 프레임 광선 구간 [{from, to, light, internal}] */
    this.segments = [];
    /** "A>B" → 연결 정보 (A에서 나온 빛이 B에 닿음) */
    this.links = new Map();
    this.renderer = new BeamRenderer(ctx.scene);
  }

  update() {
    this.segments = [];
    this.links.clear();
    // 도구가 respond 안에서 쓰는 프레임별 기록장 (측정값 표시용). 매 프레임 비워서 오래된 값이 남지 않게.
    for (const e of this.ctx.entities.entities) e.state.optics = {};
    for (const e of this.ctx.entities.entities) {
      const rays = e.def.optics?.emit?.(e, this.ctx) ?? [];
      e.state.firstHit = null;
      for (const r of rays) {
        const hit = this.#trace({ ...r, emitter: e, history: [{ entity: e, at: 0 }], pathLength: 0 }, 0);
        e.state.firstHit ??= hit;
      }
    }
    this.renderer.draw(this.segments);
  }

  /** A에서 나온 빛이 B에 닿았는가 (방향 무관 조회) */
  linkBetween(a, b) {
    return this.links.get(pairKey(a, b)) ?? this.links.get(pairKey(b, a)) ?? null;
  }

  // ───────────────────────────────────────────────────────────
  #cast(origin, direction, exclude) {
    this.raycaster.set(origin, direction);
    this.raycaster.far = MAX_DIST;
    const targets = [...this.ctx.staticBlockers];
    for (const e of this.ctx.entities.entities) if (e.mesh) targets.push(e.mesh);
    return this.raycaster.intersectObjects(targets, true).find(
      (h) => !h.object.userData.noRaycast && h.object.userData.entity !== exclude,
    );
  }

  /**
   * @param ray { origin:Vector3, direction:Vector3, light:{wavelength,power,coherent,...},
   *              emitter:Entity, history:[{entity, at}], pathLength }
   * @returns 첫 히트 정보
   */
  #trace(ray, depth) {
    const hit = this.#cast(ray.origin, ray.direction, ray.emitter);
    const to = hit ? hit.point.clone() : ray.origin.clone().addScaledVector(ray.direction, MAX_DIST);
    const dist = hit ? hit.distance : MAX_DIST;
    // 스크린처럼 스스로 광점을 그리는 면(userData.noSpot)에는 3D 광점을 겹쳐 그리지 않는다
    this.segments.push({ from: ray.origin.clone(), to, light: ray.light, terminal: true, noDot: !!hit?.object.userData.noSpot });
    const seg = this.segments[this.segments.length - 1];

    const target = hit?.object.userData.entity ?? null;
    const info = { point: to, distance: dist, entity: target, object: hit?.object ?? null };
    if (!target) return info;

    // 광학적 연결 기록: 지나온 모든 소자 → 이번에 닿은 소자
    const total = ray.pathLength + dist;
    for (const h of ray.history) {
      if (h.entity === target) continue;
      const k = pairKey(h.entity, target);
      if (!this.links.has(k)) {
        this.links.set(k, { from: h.entity, to: target, pathLength: total - h.at, light: ray.light, hit: info, ray });
      }
    }

    const respond = target.def.optics?.respond;
    if (!respond || depth >= MAX_DEPTH) return info; // respond 없음 = 불투명 = 흡수

    const res = respond(target, { origin: ray.origin, direction: ray.direction, light: ray.light }, info, this.ctx) ?? {};
    for (const s of res.segments ?? []) this.segments.push({ ...s, internal: true });
    if (res.rays?.length) seg.terminal = false;
    const history = [...ray.history, { entity: target, at: total }];
    for (const r of res.rays ?? []) {
      if (r.light.power < MIN_POWER) continue;
      this.#trace({ ...r, emitter: target, history, pathLength: total + (r.extraPath ?? 0) }, depth + 1);
    }
    return info;
  }
}

/**
 * 광선 구간 렌더링: 원기둥 메시 풀(심 + 부드러운 글로우) + 끝점 광점.
 * 톤매핑에서 제외해 파장 색이 그대로 보이게 한다.
 */
class BeamRenderer {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.userData.noRaycast = true;
    scene.add(this.group);
    const unit = (r) => new THREE.CylinderGeometry(r, r, 1, 10, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
    this.coreGeo = unit(0.0022);
    this.glowGeo = unit(0.007);
    this.dotGeo = new THREE.SphereGeometry(0.011, 16, 12);
    this.haloGeo = new THREE.SphereGeometry(0.028, 16, 12);
    this.beams = [];
    this.dots = [];
    /** 공기 중 빔의 보이는 정도 (0~1). 확대 중에는 낮춰서 스크린 무늬를 가리지 않게 */
    this.airVisibility = 1;
  }

  #beam(i) {
    if (!this.beams[i]) {
      const core = new THREE.Mesh(this.coreGeo, new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true }));
      const glow = new THREE.Mesh(this.glowGeo, new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      core.add(glow);
      core.userData.noRaycast = glow.userData.noRaycast = true;
      this.group.add(core);
      this.beams[i] = core;
    }
    return this.beams[i];
  }

  #dot(i) {
    if (!this.dots[i]) {
      const d = new THREE.Mesh(this.dotGeo, new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true }));
      d.add(new THREE.Mesh(this.haloGeo, new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })));
      d.traverse((o) => (o.userData.noRaycast = true));
      this.group.add(d);
      this.dots[i] = d;
    }
    return this.dots[i];
  }

  draw(segments) {
    const dir = new THREE.Vector3();
    let di = 0;
    segments.forEach((s, i) => {
      const b = this.#beam(i);
      const c = wavelengthToColor(s.light.wavelength);
      // 밝기: 출력 5 mW 기준 로그 스케일 (눈은 세기에 로그로 반응)
      const k = THREE.MathUtils.clamp(1 + 0.3 * Math.log10(s.light.power / 5e-3), 0.15, 1.2);
      b.material.color.copy(c);
      b.material.opacity = Math.min(1, 0.35 + 0.65 * k) * this.airVisibility;
      b.children[0].material.color.copy(c);
      b.children[0].material.opacity = 0.22 * k * this.airVisibility;
      b.position.copy(s.from);
      dir.subVectors(s.to, s.from);
      const L = dir.length();
      b.scale.set(Math.max(0.5, k), Math.max(0.5, k), L);
      b.lookAt(s.to);
      b.visible = L > 1e-5;
      if (s.terminal && !s.internal && !s.noDot) {
        const d = this.#dot(di++);
        d.position.copy(s.to);
        d.material.color.copy(c);
        d.children[0].material.color.copy(c);
        d.scale.setScalar(Math.max(0.4, k));
        d.visible = true;
      }
    });
    for (let i = segments.length; i < this.beams.length; i++) this.beams[i].visible = false;
    for (let i = di; i < this.dots.length; i++) this.dots[i].visible = false;
  }
}
