// 에셋 규칙 테스트: assets.json 구조 / lab.json 참조 무결성 / placeholder 원점 규약.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPlaceholder } from '../src/assets/placeholder';
import type { AssetsFile, LabFile } from '../src/config/types';

const load = <T>(f: string): T => JSON.parse(readFileSync(`public/${f}`, 'utf8')) as T;
const assetsFile = load<AssetsFile>('assets.json');
const lab = load<LabFile>('lab.json');

describe('assets.json', () => {
  it('모든 에셋은 model(문자열|null)과 placeholder 를 가진다', () => {
    for (const [name, e] of Object.entries(assetsFile.assets)) {
      expect(e.model === null || typeof e.model === 'string', name).toBe(true);
      expect(['box', 'room'], name).toContain(e.placeholder.shape);
      expect(e.placeholder.sizeM, name).toHaveLength(3);
    }
  });
  it('lab.json 이 참조하는 에셋은 전부 assets.json 에 존재', () => {
    for (const f of lab.fixtures) expect(assetsFile.assets).toHaveProperty(f.asset);
  });
});

describe('placeholder', () => {
  it('원점 = 바닥 중앙 (바운딩박스 min.y=0, x·z 중심 0)', () => {
    const mesh = createPlaceholder({ shape: 'box', sizeM: [2, 0.9, 1], color: '#000000' });
    const box = new THREE.Box3().setFromObject(mesh);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(0.9);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0);
  });
});
