export function drawSun(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  time: number
) {
  const baseRadius = 30;
  const pulse = Math.sin(time * 0.8) * 2 + baseRadius;

  // Volumetric light — very large diffuse glow that lights the scene
  const volumetric = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulse * 12);
  volumetric.addColorStop(0, 'rgba(255, 200, 120, 0.06)');
  volumetric.addColorStop(0.3, 'rgba(255, 150, 60, 0.02)');
  volumetric.addColorStop(0.6, 'rgba(255, 100, 30, 0.008)');
  volumetric.addColorStop(1, 'rgba(255, 60, 0, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, pulse * 12, 0, Math.PI * 2);
  ctx.fillStyle = volumetric;
  ctx.fill();

  // Outer corona — soft atmospheric glow
  const corona3 = ctx.createRadialGradient(cx, cy, pulse * 0.8, cx, cy, pulse * 5);
  corona3.addColorStop(0, 'rgba(255, 180, 80, 0.12)');
  corona3.addColorStop(0.3, 'rgba(255, 130, 40, 0.04)');
  corona3.addColorStop(0.7, 'rgba(255, 80, 20, 0.01)');
  corona3.addColorStop(1, 'rgba(255, 40, 0, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, pulse * 5, 0, Math.PI * 2);
  ctx.fillStyle = corona3;
  ctx.fill();

  // Mid corona with slight flicker
  const flicker = Math.sin(time * 3.5) * 0.02 + 0.1;
  const corona2 = ctx.createRadialGradient(cx, cy, pulse * 0.5, cx, cy, pulse * 2.5);
  corona2.addColorStop(0, `rgba(255, 210, 140, ${flicker + 0.08})`);
  corona2.addColorStop(0.5, `rgba(255, 160, 70, ${flicker * 0.5})`);
  corona2.addColorStop(1, 'rgba(255, 100, 30, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, pulse * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = corona2;
  ctx.fill();

  // Inner hot corona
  const corona1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulse * 1.5);
  corona1.addColorStop(0, 'rgba(255, 240, 200, 0.3)');
  corona1.addColorStop(0.4, 'rgba(255, 200, 120, 0.15)');
  corona1.addColorStop(1, 'rgba(255, 140, 50, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, pulse * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = corona1;
  ctx.fill();

  // Sun surface — the actual "star"
  const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulse);
  sunGrad.addColorStop(0, '#fffdf5');
  sunGrad.addColorStop(0.1, '#fff8e8');
  sunGrad.addColorStop(0.35, '#ffcc66');
  sunGrad.addColorStop(0.6, '#ff9933');
  sunGrad.addColorStop(0.85, '#dd6611');
  sunGrad.addColorStop(1, '#993300');
  ctx.beginPath();
  ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
  ctx.fillStyle = sunGrad;
  ctx.fill();

  // Surface detail — subtle turbulence
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  for (let i = 0; i < 5; i++) {
    const angle = time * 0.2 + i * 1.25;
    const dist = pulse * (0.3 + Math.sin(time + i * 2) * 0.15);
    const sx = cx + Math.cos(angle) * dist;
    const sy = cy + Math.sin(angle) * dist;
    const spotR = pulse * (0.15 + Math.sin(time * 1.5 + i) * 0.05);
    const spot = ctx.createRadialGradient(sx, sy, 0, sx, sy, spotR);
    spot.addColorStop(0, 'rgba(255, 255, 200, 0.15)');
    spot.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.beginPath();
    ctx.arc(sx, sy, spotR, 0, Math.PI * 2);
    ctx.fillStyle = spot;
    ctx.fill();
  }
  ctx.restore();

  // Bright core specular
  const spec = ctx.createRadialGradient(cx - 5, cy - 5, 0, cx, cy, pulse * 0.35);
  spec.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
  spec.addColorStop(0.5, 'rgba(255, 255, 240, 0.2)');
  spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, pulse * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = spec;
  ctx.fill();
}
