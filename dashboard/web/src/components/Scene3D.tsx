import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { useMemo, useRef, type MutableRefObject } from "react";
import {
  ledLocalPositions,
  panelXOffset,
  rigWidth,
  PANEL_D,
} from "../lib/led-geometry";
import { NUM_PANELS, PANEL_LEDS } from "../effects/types";
import { usePanelGeometry } from "../lib/panel-geometry";

// ─── shaders — the chevron mesh itself lights up on its front half ──────
const GLOW_VERT = /* glsl */ `
  varying vec3 vLocalPos;
  varying vec3 vWorldNormal;
  void main() {
    vLocalPos = position;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLOW_FRAG = /* glsl */ `
  uniform vec3 ledPositions[16];
  uniform vec3 ledColors[16];
  uniform vec3 baseColor;
  uniform float panelHalfDepth;
  uniform float glowRadius;
  uniform float glowStrength;

  varying vec3 vLocalPos;
  varying vec3 vWorldNormal;

  void main() {
    // Keyed lambert with darker ambient — higher contrast between lit/unlit
    vec3 lightDir = normalize(vec3(0.3, 0.7, 0.9));
    float NdotL = max(dot(vWorldNormal, lightDir), 0.0);
    vec3 color = baseColor * (0.18 + 0.55 * NdotL);

    // Depth gate: starts ~4mm behind mid-panel, fully lit by peaks
    float depthGate = smoothstep(-4.0, panelHalfDepth * 0.85, vLocalPos.z);
    // Normal gate: forward-facing fragments catch more light
    float normalGate = max(vWorldNormal.z * 0.65 + 0.35, 0.0);
    float gate = depthGate * normalGate;

    if (gate > 0.004) {
      vec3 glow = vec3(0.0);
      for (int i = 0; i < 16; i++) {
        float d = length(vLocalPos - ledPositions[i]);
        float t = clamp(d / glowRadius, 0.0, 1.0);
        float w = pow(1.0 - t, 2.0);
        glow += ledColors[i] * w;
      }
      color += glow * gate * glowStrength;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

function PanelMesh({
  geom,
  panelIdx,
  frameRef,
}: {
  geom: THREE.BufferGeometry;
  panelIdx: number;
  frameRef: MutableRefObject<Uint8Array>;
}) {
  const localPts = useMemo(() => ledLocalPositions(), []);
  const uniforms = useMemo(
    () => ({
      ledPositions: { value: localPts.map((p) => p.clone()) },
      ledColors: {
        value: Array.from({ length: PANEL_LEDS }, () => new THREE.Color()),
      },
      baseColor: { value: new THREE.Color("#7a7f87") },
      panelHalfDepth: { value: PANEL_D / 2 },
      glowRadius: { value: 80.0 },
      glowStrength: { value: 1.25 },
    }),
    [localPts],
  );

  useFrame(() => {
    const buf = frameRef.current;
    const colors = uniforms.ledColors.value as THREE.Color[];
    for (let i = 0; i < PANEL_LEDS; i++) {
      const o = (panelIdx * PANEL_LEDS + i) * 3;
      colors[i].setRGB(buf[o] / 255, buf[o + 1] / 255, buf[o + 2] / 255);
    }
  });

  return (
    <mesh geometry={geom}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={GLOW_VERT}
        fragmentShader={GLOW_FRAG}
        toneMapped={false}
      />
    </mesh>
  );
}

function PanelRig({ frameRef }: { frameRef: MutableRefObject<Uint8Array> }) {
  const geom = usePanelGeometry();

  const localPts = useMemo(() => ledLocalPositions(), []);
  const ledRefs = useRef<THREE.Mesh[][]>(
    Array.from({ length: NUM_PANELS }, () => [] as THREE.Mesh[]),
  );
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const buf = frameRef.current;
    for (let p = 0; p < NUM_PANELS; p++) {
      for (let i = 0; i < PANEL_LEDS; i++) {
        const mesh = ledRefs.current[p][i];
        if (!mesh) continue;
        const o = (p * PANEL_LEDS + i) * 3;
        const r = buf[o] / 255;
        const g = buf[o + 1] / 255;
        const b = buf[o + 2] / 255;
        tmp.setRGB(r, g, b);
        (mesh.material as THREE.MeshBasicMaterial).color.copy(tmp);
        const peak = Math.max(r, g, b);
        mesh.scale.setScalar(0.85 + peak * 0.3);
      }
    }
  });

  if (!geom) return null;

  return (
    <>
      {Array.from({ length: NUM_PANELS }, (_, p) => p).map((p) => (
        <group key={p} position={[panelXOffset(p), 0, 0]}>
          <PanelMesh geom={geom} panelIdx={p} frameRef={frameRef} />
          {localPts.map((pt, i) => (
            <mesh
              key={i}
              ref={(el) => {
                if (el) ledRefs.current[p][i] = el;
              }}
              position={[pt.x, pt.y, pt.z]}
            >
              <sphereGeometry args={[1.3, 12, 12]} />
              <meshBasicMaterial color="#000" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function CameraDrift() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    camera.position.x += Math.sin(t * 0.15) * 0.02;
    camera.position.y += Math.cos(t * 0.11) * 0.02;
  });
  return null;
}

function Ground() {
  return (
    <group position={[0, -70, 0]}>
      <gridHelper
        args={[800, 40, new THREE.Color("#2a2e3a"), new THREE.Color("#171923")]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[800, 800]} />
        <meshStandardMaterial
          color="#0b0c10"
          metalness={0}
          roughness={1}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

export function Scene3D({
  frameRef,
}: {
  frameRef: MutableRefObject<Uint8Array>;
}) {
  const rig = rigWidth();
  const camZ = Math.max(300, rig * 1.5);
  const maxDist = Math.max(500, rig * 2.3);
  const fogNear = camZ * 0.85;
  const fogFar = camZ * 2.1;
  return (
    <Canvas
      camera={{ position: [0, 60, camZ], fov: 28 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.75]}
    >
      <fog attach="fog" args={["#0b0c10", fogNear, fogFar]} />
      {/* scene lights are for the ground only — the chevron uses its own shader */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[120, 180, 120]}
        intensity={0.5}
        color="#fff1d6"
      />

      <Ground />
      <PanelRig frameRef={frameRef} />
      <CameraDrift />

      <OrbitControls
        enablePan={false}
        minDistance={180}
        maxDistance={maxDist}
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.58}
        enableDamping
        dampingFactor={0.06}
      />

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.9}
          luminanceThreshold={0.35}
          luminanceSmoothing={0.35}
          mipmapBlur
          radius={0.8}
        />
      </EffectComposer>
    </Canvas>
  );
}
