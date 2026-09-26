import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AssetsFile } from '../config/types';
import { createPlaceholder } from './placeholder';

/**
 * 모든 3D 시각 요소는 이 레지스트리를 통해 이름으로만 생성한다.
 * model 이 null 이면 placeholder, 아니면 .glb 를 로드한다.
 */
export class AssetRegistry {
  private readonly loader = new GLTFLoader();
  private readonly modelCache = new Map<string, Promise<THREE.Object3D>>();

  constructor(private readonly file: AssetsFile) {}

  async create(name: string): Promise<THREE.Object3D> {
    const entry = this.file.assets[name];
    if (!entry) throw new Error(`assets.json 에 없는 에셋: ${name}`);

    if (entry.model === null) return createPlaceholder(entry.placeholder);

    const url = `${import.meta.env.BASE_URL}${entry.model}`;
    let cached = this.modelCache.get(url);
    if (!cached) {
      cached = this.loader.loadAsync(url).then((gltf) => gltf.scene);
      this.modelCache.set(url, cached);
    }
    try {
      return (await cached).clone(true);
    } catch (err) {
      console.warn(`모델 로드 실패, placeholder 사용: ${name}`, err);
      return createPlaceholder(entry.placeholder);
    }
  }
}
