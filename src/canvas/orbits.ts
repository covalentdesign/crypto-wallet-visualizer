import type { Camera, Planet } from '../types';
import { projectOrbitPoint } from './planets';

// Re-export Camera for backwards compatibility
export type { Camera } from '../types';

const ORBIT_SEGMENTS = 120; // sample points per orbit ring

/**
 * Draw each planet's orbit as a 3D-projected path.
 * Each chain has a different orbital plane, so we trace the full ring
 * by sampling points and connecting them.
 * Orbit segments behind the sun (positive z) are drawn dimmer for depth.
 */
export function drawOrbits(
  ctx: CanvasRenderingContext2D,
  planets: Planet[],
  centerX: number,
  centerY: number,
  _time: number,
  camera: Camera,
  disabledChains?: Set<string>
) {
  // Deduplicate orbits: group by orbitRadius + plane to avoid drawing the same ring twice
  const drawn = new Set<string>();

  for (const planet of planets) {
    const key = `${planet.orbitRadius.toFixed(1)}_${planet.planeTiltX.toFixed(3)}_${planet.planeTiltZ.toFixed(3)}`;
    if (drawn.has(key)) continue;
    drawn.add(key);

    const disabled = disabledChains?.has(planet.interaction.primaryChain) ?? false;
    if (disabled) continue;

    const r = planet.orbitRadius;
    const hovered = planet.hovered;

    // Sample points around the orbit
    const points: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
      const a = (i / ORBIT_SEGMENTS) * Math.PI * 2;
      points.push(
        projectOrbitPoint(a, r, planet.planeTiltX, planet.planeTiltZ, centerX, centerY, camera)
      );
    }

    // Draw orbit as segments with depth-based opacity
    for (let i = 0; i < ORBIT_SEGMENTS; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const avgZ = (p0.z + p1.z) / 2;

      // Segments behind (positive z) are dimmer
      const depthFade = Math.max(0.08, 1 - avgZ / 500);

      // Soft glow layer
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = `rgba(100, 140, 180, ${0.04 * depthFade})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Main orbit line
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = `rgba(140, 160, 190, ${0.18 * depthFade})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Brighter on hover
      if (hovered) {
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = `rgba(180, 200, 230, ${0.35 * depthFade})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = `rgba(140, 180, 220, ${0.08 * depthFade})`;
        ctx.lineWidth = 6;
        ctx.stroke();
      }
    }

  }
}
