import type { Star } from '../types';

/** Place stars on a 3D sphere. We store spherical coords in x (theta) and y (phi). */
export function createStarfield(_width: number, _height: number, count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    // Uniform distribution on a sphere
    const theta = Math.random() * Math.PI * 2;        // azimuth 0..2PI
    const phi = Math.acos(2 * Math.random() - 1);     // polar 0..PI (uniform)
    const depth = 0.3 + Math.random() * 0.7;          // depth = visual size/brightness

    stars.push({
      x: theta, // store spherical theta
      y: phi,   // store spherical phi
      size: 0.5 + depth * 2.0,
      brightness: 0.4 + depth * 0.6,
      twinkleSpeed: Math.random() * 2 + 0.5,
      twinkleOffset: Math.random() * Math.PI * 2,
      depth,
    });
  }
  return stars;
}

export function drawStarfield(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  time: number,
  rotationY: number,
  tiltX: number
) {
  const w = ctx.canvas.width / (window.devicePixelRatio || 1);
  const h = ctx.canvas.height / (window.devicePixelRatio || 1);
  const cx = w / 2;
  const cy = h / 2;
  const fov = Math.max(w, h) * 0.8; // field of view scaling

  for (const star of stars) {
    const theta = star.x; // azimuth
    const phi = star.y;   // polar

    // Convert spherical to cartesian (unit sphere)
    const sinPhi = Math.sin(phi);
    let sx = sinPhi * Math.cos(theta);
    let sy = Math.cos(phi);
    let sz = sinPhi * Math.sin(theta);

    // Apply camera Y rotation (horizontal drag)
    const cosR = Math.cos(rotationY);
    const sinR = Math.sin(rotationY);
    const rx = sx * cosR - sz * sinR;
    const rz = sx * sinR + sz * cosR;
    sx = rx;
    sz = rz;

    // Apply camera X tilt (vertical drag)
    const cosT = Math.cos(tiltX);
    const sinT = Math.sin(tiltX);
    const ry = sy * cosT - sz * sinT;
    const rz2 = sy * sinT + sz * cosT;
    sy = ry;
    sz = rz2;

    // Skip stars behind camera
    if (sz < 0.05) continue;

    // Project to screen
    const scale = fov / (fov + sz * fov);
    const px = cx + sx * fov * scale;
    const py = cy + sy * fov * scale;

    // Skip if off screen
    if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;

    const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.25 + 0.75;
    const alpha = star.brightness * twinkle * (0.7 + sz * 0.3); // keep visible even near edges
    const drawSize = star.size * scale;

    ctx.beginPath();
    ctx.arc(px, py, drawSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(210, 225, 255, ${alpha})`;
    ctx.fill();

    // Glow on brighter stars — lower threshold so more stars glow
    if (drawSize > 0.6) {
      ctx.beginPath();
      ctx.arc(px, py, drawSize * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160, 190, 255, ${alpha * 0.15})`;
      ctx.fill();
    }
  }
}
