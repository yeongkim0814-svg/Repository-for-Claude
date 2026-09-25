/**
 * 도구 등록 진입점. 새 도구 = 새 파일 하나 + 여기 import 한 줄.
 *
 *   // src/tools/Slit.js
 *   export const SlitTool = ToolRegistry.define({
 *     type: 'slit', label: '단일 슬릿', icon: '▮', physicsDomain: ['optical'],
 *     defaultProperties: { width: 0.1, screenDistance: 1.0 },   // mm, m
 *     propertyMeta: { width: { label: '슬릿 폭 a', min: 0.01, max: 1, unit: 'mm' } },
 *     interactionPorts: [{ name: 'in', type: 'beam_input', origin: [0,0.15,0], direction: [0,0,-1] }],
 *     footprint: () => ({ x: 0.1, y: 0.12, z: 0.02 }),
 *     buildMesh: (p) => …,
 *   });
 *
 * 찬장 목록, 고스트, 설정 패널은 자동으로 이 도구를 인식한다.
 */
import './Pulley.js';
import './Laser.js';
// Phase 1: 광학
import './optics/RayBox.js';
import './optics/Mirror.js';
import './optics/Lens.js';
import './optics/Slit.js';
import './optics/Screen.js';
import './optics/GlassBlock.js';
