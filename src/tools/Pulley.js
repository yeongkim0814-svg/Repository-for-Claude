/**
 * ============================================================================
 *  도르래 (Atwood machine)  —  physicsDomain: ["mechanical"]
 * ============================================================================
 *
 *  구성 (Rapier)
 *   anchor(fixed)  ── RevoluteJoint(축 = 로컬 Z) ──  wheel(dynamic, 원판)
 *   추 2개(kinematicPositionBased) : 로프가 미끄러지지 않으므로 바퀴 각도 θ로 위치가 결정됨
 *
 *  ── 물리 모델: 계를 "자유도 1개(θ)"로 축약 ──────────────────────────────────
 *   로프가 미끄러지지 않고 늘어나지 않으면  y_L = d₀ + Rθ,  y_R = d₀ − Rθ  (아래 방향 +)
 *   → 추의 속도 = ±Rω. 두 추와 바퀴는 하나의 강체처럼 같이 움직인다.
 *
 *   회전 운동방정식 τ = I_eff · α 에서
 *     τ     = (m_L − m_R) g R  − τ_마찰                         (중력이 만드는 알짜 토크)
 *     I_eff = ½ M R²  +  (m_L + m_R) R²                        (바퀴 + 추를 축에서 본 관성)
 *   양변을 R로 나누면 교과서의 앳우드 공식:
 *     a = R·α = [(m_L − m_R) g − τ_f / R] / (m_L + m_R + M/2)
 *
 *   구현: Rapier 바퀴 바디에
 *     · 콜라이더 질량 M  → Rapier가 원판 관성 ½MR² 자동 계산
 *     · setAdditionalMassProperties 로 (m_L+m_R)R² 를 축 방향 관성에 추가
 *     · 매 스텝 addTorque(τ) → Rapier가 RevoluteJoint 제약 아래에서 적분
 *   추는 키네마틱 바디로 θ를 따라 움직이므로 Rapier 충돌 이벤트(다른 역학 도구와의
 *   근접)에는 정상 참여한다.
 *
 *  ── 이 모델이 "어디서 깨지는가" ──────────────────────────────────────────
 *   · 로프 질량·신축 무시 (실제 로프는 늘어나며 진동 → 여기선 없음)
 *   · 추가 흔들리는 진자 운동 무시 (추는 수직선에서만 움직임)
 *   · 마찰은 쿨롱형 축 마찰 토크(크기 일정)로만 모델링
 *   → 다음 Phase에서 로프를 여러 강체 + SphericalJoint 사슬로 바꾸면 흔들림을 얻지만,
 *     수치 강성 문제(질량비가 크면 불안정)가 생긴다는 트레이드오프가 있다.
 */
import * as THREE from 'three';
import { ToolRegistry } from '../core/ToolRegistry.js';
import { worldToLocalQuat } from '../core/EntityManager.js';
import { PALETTE as C, toy, metal, rbox, cyl } from '../scene/style.js';

const G = 9.81;
const AXLE_H = 0.62;          // 받침 바닥 → 축 높이 (m)
const W_RADIUS = 0.024;       // 추 반지름 (시각)
const PLATE_TOP = 0.02;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** 추 높이(시각용): 질량이 클수록 길게 (0.1 kg → 5 cm, 0.5 kg → 13 cm) */
const weightHeight = (m) => 0.03 + 0.2 * m;

function limits(p) {
  const R = p.radius;
  const dMin = R + 0.03;                                   // 추가 바퀴에 닿기 직전
  const dMaxL = AXLE_H - PLATE_TOP - weightHeight(p.massLeft) - 0.012;  // 받침판에 닿음
  const dMaxR = AXLE_H - PLATE_TOP - weightHeight(p.massRight) - 0.012;
  const d0 = (dMin + Math.min(dMaxL, dMaxR)) / 2;
  return {
    d0,
    thetaMax: Math.min(dMaxL - d0, d0 - dMin) / R,   // 왼쪽 추가 내려가는 방향(+θ)
    thetaMin: -Math.min(dMaxR - d0, d0 - dMin) / R,
  };
}

function theoryAccel(p) {
  const drive = (p.massLeft - p.massRight) * G * p.radius; // N·m
  if (Math.abs(drive) <= p.friction) return 0;
  const net = drive - Math.sign(drive) * p.friction;
  return net / p.radius / (p.massLeft + p.massRight + p.wheelMass / 2);
}

export const PulleyTool = ToolRegistry.define({
  type: 'pulley',
  label: '도르래',
  icon: '🛞',
  description: '앳우드 기계. RevoluteJoint 바퀴 + 로프 양쪽의 추. "놓기"를 체크하면 운동 시작.',
  physicsDomain: ['mechanical'],
  defaultProperties: {
    radius: 0.08,
    wheelMass: 0.2,
    massLeft: 0.25,
    massRight: 0.2,
    friction: 0.001,
    released: false,
  },
  propertyMeta: {
    radius: { label: '바퀴 반지름 R', min: 0.04, max: 0.14, step: 0.005, unit: 'm' },
    wheelMass: { label: '바퀴 질량 M', min: 0.01, max: 1, step: 0.01, unit: 'kg' },
    massLeft: { label: '왼쪽 추 m_L', min: 0.05, max: 0.5, step: 0.01, unit: 'kg' },
    massRight: { label: '오른쪽 추 m_R', min: 0.05, max: 0.5, step: 0.01, unit: 'kg' },
    friction: { label: '축 마찰 토크 τ_f', min: 0, max: 0.05, step: 0.0005, unit: 'N·m' },
    released: { label: '놓기 (운동 시작)', rebuild: false },
  },
  interactionPorts: [
    // 다음 Phase: 다른 역학 도구(용수철, 추 추가)가 로프 끝에 연결될 접점
    { name: 'rope_left', type: 'rope_attach', origin: [-0.08, AXLE_H, 0], direction: [0, -1, 0] },
    { name: 'rope_right', type: 'rope_attach', origin: [0.08, AXLE_H, 0], direction: [0, -1, 0] },
  ],

  footprint: (p) => ({ x: Math.max(0.18, p.radius + W_RADIUS + 0.02), y: (AXLE_H + p.radius + 0.02) / 2, z: 0.08 }),

  buildMesh(p) {
    const R = p.radius;
    const root = new THREE.Group();
    const fpX = Math.max(0.18, R + W_RADIUS + 0.02);

    // 받침: 파란 플라스틱 판 + 흰 기둥 + 크롬 축
    const plate = new THREE.Mesh(rbox(fpX * 2, PLATE_TOP + 0.01, 0.17, 0.012), toy(C.blue));
    plate.position.y = (PLATE_TOP + 0.01) / 2 - 0.005;
    const post = new THREE.Mesh(rbox(0.036, AXLE_H + 0.04, 0.036, 0.014), toy(C.white));
    post.position.set(0, (AXLE_H + 0.04) / 2, -0.05);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), toy(C.yellow));
    cap.position.set(0, AXLE_H + 0.045, -0.05);
    const axle = new THREE.Mesh(cyl(0.008, 0.06), metal());
    axle.rotation.x = Math.PI / 2;
    axle.position.set(0, AXLE_H, -0.025);
    root.add(plate, post, cap, axle);

    // 바퀴: 빨간 원판 + 흰 살 + 노란 허브 + 홈(어두운 테) → 회전이 한눈에 보이도록
    const wheel = new THREE.Group();
    wheel.position.set(0, AXLE_H, 0);
    const disc = new THREE.Mesh(cyl(R, 0.022, R, 48), toy(C.red));
    disc.rotation.x = Math.PI / 2;
    const groove = new THREE.Mesh(new THREE.TorusGeometry(R, 0.006, 10, 48), toy(C.ink, { rough: 0.6 }));
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(rbox(R * 1.7, 0.012, 0.026, 0.005), toy(i === 0 ? C.yellow : C.white));
      spoke.rotation.z = (i * Math.PI) / 3;
      wheel.add(spoke);
    }
    const hub = new THREE.Mesh(cyl(0.016, 0.034), toy(C.yellow));
    hub.rotation.x = Math.PI / 2;
    wheel.add(disc, groove, hub);
    wheel.name = 'wheel';
    root.add(wheel);

    // 추: 반짝이는 주황(왼쪽) / 보라(오른쪽) — 어느 쪽이 m_L 인지 색으로 구분
    const { d0 } = limits(p);
    for (const [side, m, col] of [['L', p.massLeft, C.orange], ['R', p.massRight, C.purple]]) {
      const h = weightHeight(m);
      const wgt = new THREE.Group();
      const body = new THREE.Mesh(rbox(W_RADIUS * 2, h, W_RADIUS * 2, W_RADIUS * 0.6), toy(col));
      body.position.y = -h / 2 - 0.008;
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0028, 8, 16), metal());
      hook.position.y = 0.0;
      wgt.add(body, hook);
      wgt.name = `weight${side}`;
      wgt.position.set(side === 'L' ? -R : R, AXLE_H - d0, 0);
      root.add(wgt);
    }

    // 로프: 왼쪽/오른쪽 수직 원기둥(길이 = scale.y) + 바퀴 위 반원 토러스 (R이 고정이므로 정적)
    const ropeMat = toy(0xfff3d6, { rough: 0.8, clearcoat: 0 });
    for (const side of ['L', 'R']) {
      const seg = new THREE.Mesh(cyl(0.0028, 1, 0.0028, 8).translate(0, -0.5, 0), ropeMat);
      seg.name = `rope${side}`;
      seg.userData.noRaycast = true;
      root.add(seg);
    }
    const arc = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0028, 6, 32, Math.PI), ropeMat);
    arc.position.set(0, AXLE_H, 0.0);
    arc.userData.noRaycast = true;
    root.add(arc);
    updateRope(root, R, d0, d0);
    return root;
  },

  createPhysics(entity, ctx, anchor) {
    const { RAPIER, world } = ctx.physics;
    const p = entity.properties;
    const R = p.radius;
    const q = entity.transform.quaternion;
    const rq = { x: q.x, y: q.y, z: q.z, w: q.w };
    const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(entity.transform.position);

    // 바퀴: 동적 바디. 추의 관성 (m_L+m_R)R² 를 축(로컬 Z) 방향 관성에 더한다.
    const axle = toWorld(0, AXLE_H, 0);
    const wheel = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(axle.x, axle.y, axle.z)
        .setRotation(rq)
        .setCanSleep(false)
        .setAdditionalMassProperties(0, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: (p.massLeft + p.massRight) * R * R }, { x: 0, y: 0, z: 0, w: 1 }),
    );
    const cylRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const wheelCol = world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.01, R)
        .setRotation({ x: cylRot.x, y: cylRot.y, z: cylRot.z, w: cylRot.w }) // 원기둥 축 Y → Z
        .setMass(p.wheelMass)                                              // → I = ½MR²
        .setCollisionGroups(0x0001_0000),                                  // 충돌 필터 0: 질량만 제공
      wheel,
    );

    // 회전 관절: anchor의 (0, H, 0) 과 wheel 원점을 잇고, 공통 축 = 로컬 Z
    const joint = world.createImpulseJoint(
      RAPIER.JointData.revolute({ x: 0, y: AXLE_H, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }),
      anchor, wheel, true,
    );
    joint.setContactsEnabled(false);

    // 추: 키네마틱 바디 (θ에 종속)
    const lim = limits(p);
    const weights = {};
    const colliders = [wheelCol];
    for (const [side, m, x] of [['L', p.massLeft, -R], ['R', p.massRight, R]]) {
      const h = weightHeight(m);
      const pos = toWorld(x, AXLE_H - lim.d0 - h / 2, 0);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z).setRotation(rq));
      const col = world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, W_RADIUS).setMass(m), body);
      weights[side] = { body, h };
      colliders.push(col);
    }

    Object.assign(entity.state, {
      wheel, weights, lim, toWorld,
      axisW: Z_AXIS.clone().applyQuaternion(q),
      theta: 0, omega: 0, aMeasured: 0, time: 0,
    });
    return { bodies: [wheel, weights.L.body, weights.R.body], colliders, joints: [joint] };
  },

  fixedUpdate(entity, dt, ctx, phase) {
    const s = entity.state;
    const p = entity.properties;
    const R = p.radius;
    const { wheel, axisW, lim } = s;
    const av = wheel.angvel();
    const omega = av.x * axisW.x + av.y * axisW.y + av.z * axisW.z;

    if (phase === 'pre') {
      wheel.resetTorques(true);
      if (!p.released) {
        wheel.setAngvel({ x: 0, y: 0, z: 0 }, true);
        return;
      }
      const drive = (p.massLeft - p.massRight) * G * R;
      let tau;
      if (Math.abs(omega) < 1e-3 && Math.abs(drive) <= p.friction) {
        tau = 0;                     // 정지 마찰이 버팀
        wheel.setAngvel({ x: 0, y: 0, z: 0 }, true);
      } else {
        tau = drive - p.friction * Math.sign(omega || drive); // 운동 마찰은 회전 반대 방향
      }
      // 추가 받침판/바퀴에 닿은 상태에서 더 밀어붙이는 토크는 수직항력이 상쇄
      const atMax = s.theta >= lim.thetaMax - 1e-6;
      const atMin = s.theta <= lim.thetaMin + 1e-6;
      if ((atMax && tau > 0) || (atMin && tau < 0)) {
        tau = 0;
        wheel.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      wheel.addTorque({ x: axisW.x * tau, y: axisW.y * tau, z: axisW.z * tau }, true);
      return;
    }

    // phase === 'post': Rapier가 적분한 ω로 θ 갱신 (반암시적 오일러와 동일한 순서)
    // 측정 가속도 = Δv/Δt (정지 상태에서 출발 → 등가속도라면 v/t). 움직이는 동안만 시간 누적.
    if (p.released && omega !== 0) {
      s.time += dt;
      s.aMeasured = (R * omega) / s.time;
    }
    s.omega = omega;
    s.theta += omega * dt;
    if (s.theta > lim.thetaMax || s.theta < lim.thetaMin) {
      s.theta = THREE.MathUtils.clamp(s.theta, lim.thetaMin, lim.thetaMax);
      wheel.setAngvel({ x: 0, y: 0, z: 0 }, true); // 비탄성 정지
      s.omega = 0;
    }
    const dL = lim.d0 + R * s.theta;
    const dR = lim.d0 - R * s.theta;
    for (const [side, d, x] of [['L', dL, -R], ['R', dR, R]]) {
      const w = s.weights[side];
      w.body.setNextKinematicTranslation(s.toWorld(x, AXLE_H - d - w.h / 2, 0));
    }
  },

  update(entity) {
    const s = entity.state;
    const R = entity.properties.radius;
    const root = entity.mesh;
    const wheelMesh = root.getObjectByName('wheel');
    const r = s.wheel.rotation();
    worldToLocalQuat(entity, new THREE.Quaternion(r.x, r.y, r.z, r.w), wheelMesh.quaternion);

    const dL = s.lim.d0 + R * s.theta;
    const dR = s.lim.d0 - R * s.theta;
    root.getObjectByName('weightL').position.set(-R, AXLE_H - dL, 0);
    root.getObjectByName('weightR').position.set(R, AXLE_H - dR, 0);
    updateRope(root, R, dL, dR);
  },

  onPropertyChange(entity, key) {
    if (key === 'released' && !entity.properties.released) entity.state.aMeasured = 0;
  },

  readouts(entity) {
    const s = entity.state;
    const p = entity.properties;
    const aT = theoryAccel(p);
    const aM = p.released ? s.aMeasured : 0;
    return {
      '바퀴 각도 θ': `${s.theta.toFixed(3)} rad`,
      '각속도 ω': `${s.omega.toFixed(3)} rad/s`,
      '왼쪽 추 속력 v = Rω': `${(p.radius * s.omega).toFixed(3)} m/s`,
      '가속도 a = Δv/Δt (Rapier 측정)': `${aM.toFixed(4)} m/s²`,
      '가속도 a (이론)': `${aT.toFixed(4)} m/s²`,
      '장력 T_L = m_L(g−a)': `${(p.massLeft * (G - aM)).toFixed(4)} N`,
      '장력 T_R = m_R(g+a)': `${(p.massRight * (G + aM)).toFixed(4)} N`,
      '운동 시간 t': `${s.time.toFixed(2)} s`,
    };
  },

  actions: {
    reset: {
      label: '⟲ 처음 위치로',
      run(entity, ctx) {
        entity.properties.released = false;
        ctx.entities.rebuild(entity);
        ctx.ui.openProperties(entity); // 체크박스 상태 갱신
      },
    },
  },
});

function updateRope(root, R, dL, dR) {
  for (const [side, x, d] of [['L', -R, dL], ['R', R, dR]]) {
    const seg = root.getObjectByName(`rope${side}`);
    seg.position.set(x, AXLE_H, 0);
    seg.scale.y = Math.max(1e-3, d);
  }
}
