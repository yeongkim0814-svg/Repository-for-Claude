// 상호작용 엔진 단위 테스트 (브라우저·Three.js·Rapier 없이 실행): npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InteractionRegistryClass } from '../src/interaction/InteractionRegistry.js';
import { ProximityChecker } from '../src/interaction/ProximityChecker.js';
import { InteractionEngine } from '../src/interaction/InteractionEngine.js';

let id = 1;
const ent = (type, physicsDomain) => ({ id: id++, type, physicsDomain, label: `${type}#${id}` });

function setup(near = () => true) {
  const registry = new InteractionRegistryClass();
  const checker = new ProximityChecker();
  checker.register('optical', '*', 'beam', (a, b) => near(a, b) && { via: 'test-beam' });
  checker.register('mechanical', 'mechanical', 'contact', (a, b) => near(a, b) && { via: 'test-contact' });
  const engine = new InteractionEngine({ checker, registry, ctx: {} });
  return { registry, checker, engine };
}

test('Phase 0 성공 기준: 레이저-도르래는 후보가 되어도 규칙이 없으므로 아무 일도 없다', () => {
  const { engine, registry } = setup();
  const laser = ent('laser', ['optical']);
  const pulley = ent('pulley', ['mechanical']);
  assert.deepEqual([...registry.match(laser, pulley)], []);
  engine.update([laser, pulley]);
  const [c] = engine.lastReport.candidates;
  assert.equal(c.contact.via, 'test-beam');   // broad phase는 통과
  assert.deepEqual(c.rules, []);              // narrow phase 규칙 0개
  assert.equal(engine.active.size, 0);        // 진행 중인 상호작용 없음
});

test('등록된 규칙은 선언한 인자 순서로 호출되고 enter/update/exit 수명주기를 따른다', () => {
  let isNear = true;
  const { engine, registry } = setup(() => isNear);
  const calls = [];
  registry.register('laser', 'slit', {
    name: '회절',
    onEnter: (l, s) => calls.push(['enter', l.type, s.type]),
    onUpdate: (l, s, ctx) => calls.push(['update', l.type, s.type, ctx.contact.via]),
    onExit: (l, s) => calls.push(['exit', l.type, s.type]),
  });
  const slit = ent('slit', ['optical']);
  const laser = ent('laser', ['optical']);
  engine.update([slit, laser]); // 엔진은 (slit, laser) 순으로 쌍을 만나지만…
  engine.update([slit, laser]);
  isNear = false;
  engine.update([slit, laser]);
  assert.deepEqual(calls, [
    ['enter', 'laser', 'slit'], // …핸들러는 항상 (laser, slit)
    ['update', 'laser', 'slit', 'test-beam'],
    ['update', 'laser', 'slit', 'test-beam'],
    ['exit', 'laser', 'slit'],
  ]);
});

test('broad phase: 해당 도메인 조합의 전략이 없으면 후보가 되지 않는다', () => {
  const { checker } = setup();
  const a = ent('thermometer', ['thermal']);
  const b = ent('pulley', ['mechanical']);
  assert.equal(checker.checkProximity(a, b), null);
});

test('broad phase: 다중 도메인 도구는 도메인 조합 중 하나라도 맞으면 후보', () => {
  const { checker } = setup();
  const photocell = ent('photocell', ['electromagnetic', 'optical']);
  const b = ent('pulley', ['mechanical']);
  const r = checker.checkProximity(photocell, b);
  assert.equal(r.strategy, 'beam');
  assert.deepEqual(r.domains, ['optical', 'mechanical']);
});

test('같은 쌍에 여러 규칙, 같은 타입 쌍 규칙도 가능', () => {
  const { engine, registry } = setup();
  let n = 0;
  registry.register('pulley', 'pulley', () => n++);
  registry.register('pulley', 'pulley', () => n++);
  engine.update([ent('pulley', ['mechanical']), ent('pulley', ['mechanical'])]);
  assert.equal(n, 2);
});
