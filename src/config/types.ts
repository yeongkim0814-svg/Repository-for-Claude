// public/assets.json, public/lab.json 의 타입 정의.
// 시각 요소 값(색·크기·모양)은 전부 assets.json 에서만 온다.

export type Vec3 = [number, number, number];

export type PlaceholderSpec =
  | { shape: 'box'; sizeM: Vec3; color: string }
  // 안쪽 면이 보이는 상자. 바닥면이 y=0.
  | { shape: 'room'; sizeM: Vec3; color: string };

export interface AssetEntry {
  /** .glb 경로(public/ 기준). null 이면 placeholder 를 표시한다. */
  model: string | null;
  placeholder: PlaceholderSpec;
}

export interface EnvironmentSpec {
  backgroundColor: string;
  ambientLightColor: string;
  ambientLightIntensity: number;
  sunLightColor: string;
  sunLightIntensity: number;
  sunLightDirection: Vec3;
}

export interface AssetsFile {
  environment: EnvironmentSpec;
  assets: Record<string, AssetEntry>;
}

export interface FixturePlacement {
  asset: string;
  positionM: Vec3;
  rotationYDeg: number;
}

export interface WalkArea {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface LabFile {
  fixtures: FixturePlacement[];
  player: {
    startPositionM: Vec3;
    startYawDeg: number;
    eyeHeightM: number;
    walkSpeedMPerS: number;
    walkAreaM: WalkArea;
  };
  camera: { fovDeg: number; nearM: number; farM: number };
  controls: {
    joystickRadiusPx: number;
    lookSensitivityRadPerPx: number;
    maxPitchDeg: number;
  };
}
