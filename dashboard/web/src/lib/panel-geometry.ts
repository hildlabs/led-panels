import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { useEffect, useState } from "react";
import { PANEL_D, PANEL_H, PANEL_W } from "./led-geometry";

/**
 * The panel model used for the real build is not redistributable, so the repo
 * does not ship it. If `public/square.stl` exists it is used; otherwise the
 * preview falls back to a generated chevron relief with the same footprint.
 */
const STL_URL = "/square.stl";

function centered(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  g.translate(
    -(bb.max.x + bb.min.x) / 2,
    -(bb.max.y + bb.min.y) / 2,
    -(bb.max.z + bb.min.z) / 2,
  );
  g.computeVertexNormals();
  return g;
}

/** Faceted chevron relief, PANEL_W × PANEL_H, depth PANEL_D. */
export function chevronGeometry(): THREE.BufferGeometry {
  const seg = 150;
  const plane = new THREE.PlaneGeometry(PANEL_W, PANEL_H, seg, seg);
  const pos = plane.attributes.position;
  const period = PANEL_W / 4; // four chevrons across
  const rows = PANEL_H / 10; // vertical pitch
  const tri = (v: number) => 1 - Math.abs(((v % 2) + 2) % 2 - 1); // 0..1..0
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const local = Math.abs((((x + PANEL_W / 2) % period) + period) % period - period / 2);
    const h = tri((y + local) / rows);
    pos.setZ(i, h * PANEL_D);
  }
  // back plate so the panel reads as a solid tile from the side
  const back = new THREE.PlaneGeometry(PANEL_W, PANEL_H);
  back.rotateY(Math.PI);
  const merged = new THREE.BufferGeometry();
  const a = plane.toNonIndexed();
  const b = back.toNonIndexed();
  const arr = new Float32Array(a.attributes.position.array.length + b.attributes.position.array.length);
  arr.set(a.attributes.position.array as Float32Array, 0);
  arr.set(b.attributes.position.array as Float32Array, a.attributes.position.array.length);
  merged.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  return centered(merged);
}

/** Loads the STL if present, else returns the generated chevron. */
export function usePanelGeometry(): THREE.BufferGeometry | null {
  const [geom, setGeom] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let g: THREE.BufferGeometry | null = null;
      try {
        const r = await fetch(STL_URL);
        const buf = r.ok ? await r.arrayBuffer() : null;
        // SPA fallbacks answer unknown paths with index.html, so check the first byte
        if (buf && buf.byteLength > 84 && new Uint8Array(buf)[0] !== 0x3c /* "<" */) {
          g = centered(new STLLoader().parse(buf));
        }
      } catch {
        /* fall through to the generated panel */
      }
      if (!cancelled) setGeom(g ?? chevronGeometry());
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return geom;
}
