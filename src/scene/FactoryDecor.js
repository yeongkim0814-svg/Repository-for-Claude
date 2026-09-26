/**
 * ============================================================================
 *  FactoryDecor — Kenney "Factory Kit" 소품으로 배경을 채우는 순수 장식 레이어
 * ============================================================================
 *
 *  buildLabScene()이 만드는 것(테이블·찬장·칠판 등)은 게임플레이에 쓰이는
 *  "진짜" 구조물이다. 이 파일이 배치하는 것은 전부 **배경 분위기**용 장식이다.
 *  글TF 로딩은 비동기이므로 buildLabScene과 분리해 두었다 — main.js가
 *  buildLabScene() 이후 이 함수를 fire-and-forget으로 호출하고, 소품은
 *  로드되는 대로 하나씩 씬에 나타난다 (실행을 막지 않음).
 *
 *  배치 좌표는 ROOM/TABLE/CABINET 상수를 기준으로 계산해 방 구조가 바뀌어도
 *  (예: ROOM.halfZ 조정) 웬만큼 같이 따라간다.
 */
import { ROOM, TABLE, CABINET, cabinetBayZ } from './LabScene.js';
import { placeKitProp } from './KitAssets.js';

export async function dressFactoryDecor(ctx) {
  const jobs = [];
  const at = (name, opts) => jobs.push(placeKitProp(ctx, name, opts).catch((e) => console.warn(name, e)));

  // ── 진열장 안: 유리 너머로 보이는 "진짜" 소품 몇 개 ──────────────
  // (선반 중앙 — 절차적 장식품은 좌우로 비켜 놓여 있어 이 자리가 비어 있다)
  const shelfX = CABINET.x + CABINET.depth / 2 - 0.02;
  at('cog-b', { position: pos(shelfX, 1.78, cabinetBayZ(1)), scale: 0.4 });
  at('screen-panel-small', { position: pos(shelfX, 1.18, cabinetBayZ(3)), scale: 0.35 });
  at('box-wide', { position: pos(shelfX - 0.05, 0.58, cabinetBayZ(0)), scale: 0.3 });

  // ── 뒤쪽 벽(칠판 좌우) 바닥: 유리 배관 두 줄이 벽을 따라 흐름 ─────
  const backZ = -ROOM.halfZ + 0.5;
  for (const side of [-1, 1]) {
    at('pipe-glass-large-long', { position: pos(side * 6, 0, backZ) });
    at('pipe-glass-large-long', { position: pos(side * 4, 0, backZ) });
    at('pipe-glass-large-bend', { position: pos(side * 2.6, 0, backZ), rotationY: side > 0 ? Math.PI : 0 });
  }

  // ── 뒤쪽 벽 위쪽: 칠판을 감싸는 정비용 캣워크 한 쌍 ──────────────
  at('catwalk-straight', { position: pos(-4.2, 2.3, -ROOM.halfZ + 0.3) });
  at('catwalk-straight', { position: pos(4.2, 2.3, -ROOM.halfZ + 0.3), rotationY: Math.PI });

  // ── 오른쪽 벽: 이동식 카트 위·주변에 제어반 화면들 ───────────────
  const rightX = ROOM.halfX - 0.42;
  at('screen-panel-wide', { position: pos(rightX, 0, 0.5), rotationY: -Math.PI / 2, collide: true });
  at('screen-panel-small', { position: pos(rightX, 0, 1.55), rotationY: -Math.PI / 2, collide: true });
  at('screen-hanging-wide', { position: pos(ROOM.halfX - 0.08, 1.85, -2.2), rotationY: -Math.PI / 2 });

  // ── 뒤-오른쪽 구석: 큰 기계 + 팔 로봇 + 제어 레버·버튼 ──────────
  const mx = ROOM.halfX - 1.5, mz = -ROOM.halfZ + 1.0;
  at('machine-window', { position: pos(mx, 0, mz), rotationY: Math.PI * 0.75, collide: true });
  at('robot-arm-a', { position: pos(mx, 1.5, mz), rotationY: Math.PI / 3, scale: 0.9 });
  at('lever-single', { position: pos(mx + 0.8, 0, mz + 0.7), rotationY: -0.6 });
  at('button-floor-round', { position: pos(mx - 0.3, 0.001, mz + 1.1) });
  at('cog-a', { position: pos(mx - 0.9, 0.001, mz + 0.3), rotationY: 0.4 });
  at('cog-c', { position: pos(mx - 0.6, 0.001, mz + 0.6), rotationY: 1.1, scale: 0.8 });

  // ── 앞쪽(입구) 오른쪽 구석: 배관 밸브 한 벌 ──────────────────────
  at('pipe-large-valve', { position: pos(ROOM.halfX - 0.7, 0, ROOM.halfZ - 1.0), rotationY: 0.8 });
  at('pipe-large-bend', { position: pos(ROOM.halfX - 0.7, 0, ROOM.halfZ - 2.0), rotationY: -0.5 });

  // ── 앞쪽(입구) 구석: 화물 상자 더미 ──────────────────────────────
  at('box-large', { position: pos(-ROOM.halfX + 1.1, 0, ROOM.halfZ - 1.1), rotationY: 0.15, collide: true });
  at('box-long', { position: pos(-ROOM.halfX + 1.1, 0.55, ROOM.halfZ - 1.1), rotationY: 0.15 });
  at('box-wide', { position: pos(-ROOM.halfX + 0.55, 0, ROOM.halfZ - 0.6), rotationY: -0.3, collide: true });

  // ── 위험 표지판(볼라드): 진열장 양 끝, 큰 기계 옆 ───────────────
  at('warning-orange', { position: pos(CABINET.x + 0.5, 0, CABINET.zCenter + CABINET.halfZ + 0.3), collide: true });
  at('warning-traffic', { position: pos(mx + 1.1, 0, mz - 0.6), collide: true });

  // ── 앞쪽 벽: 모듈형 구조 패널 두 장 (배경 실루엣) ───────────────
  at('structure-window', { position: pos(-3, 0, ROOM.halfZ - 0.9), rotationY: Math.PI / 2 });
  at('structure-wall', { position: pos(3, 0, ROOM.halfZ - 0.9), rotationY: Math.PI / 2 });

  // ── 뒤-왼쪽 구석 천장 부근: 대형 크레인 (분위기용) ──────────────
  at('crane', { position: pos(-ROOM.halfX + 1.6, 0, -ROOM.halfZ + 1.6), rotationY: Math.PI / 4, scale: 0.7, collide: true });

  await Promise.allSettled(jobs);
}

// Vector3.copy(v)는 v.x/y/z만 읽으므로 평범한 {x,y,z} 객체로 충분하다.
function pos(x, y, z) {
  return { x, y, z };
}
