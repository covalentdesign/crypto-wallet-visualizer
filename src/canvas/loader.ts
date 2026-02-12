// Starburst loader — thin stems radiating from center with a clockwise sweeping glow

const STEM_COUNT = 12;
const INNER_RADIUS = 30;   // gap from center (sun lives here)
const OUTER_RADIUS = 220;  // max stem length

export function drawLoader(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  time: number
) {
  // Sweep angle — one full rotation every ~3 seconds
  const sweepAngle = (time * 2.1) % (Math.PI * 2);

  for (let i = 0; i < STEM_COUNT; i++) {
    const angle = (i / STEM_COUNT) * Math.PI * 2 - Math.PI / 2; // start from top

    // Vary stem lengths slightly for visual interest
    const lengthVariation = 0.7 + 0.3 * Math.sin(i * 1.7 + 0.5);
    const outerR = OUTER_RADIUS * lengthVariation;

    const x0 = centerX + Math.cos(angle) * INNER_RADIUS;
    const y0 = centerY + Math.sin(angle) * INNER_RADIUS;
    const x1 = centerX + Math.cos(angle) * outerR;
    const y1 = centerY + Math.sin(angle) * outerR;

    // Angular distance from the sweep highlight
    let angleDiff = angle - sweepAngle;
    // Normalize to -PI..PI
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Glow intensity: brightest at sweep position, fading behind (trail effect)
    // Trail is ~120 degrees behind the sweep direction
    const trailFactor = angleDiff < 0 && angleDiff > -Math.PI * 0.67
      ? 1 - Math.abs(angleDiff) / (Math.PI * 0.67)
      : 0;
    const headGlow = Math.max(0, 1 - Math.abs(angleDiff) / 0.4);
    const intensity = Math.max(headGlow, trailFactor * 0.6);

    // Base dim stem
    const baseAlpha = 0.12;
    const alpha = baseAlpha + intensity * 0.88;

    // Glow layer (wider, softer)
    if (intensity > 0.1) {
      const glowGrad = ctx.createLinearGradient(x0, y0, x1, y1);
      glowGrad.addColorStop(0, `rgba(120, 180, 240, ${intensity * 0.3})`);
      glowGrad.addColorStop(0.5, `rgba(80, 150, 220, ${intensity * 0.15})`);
      glowGrad.addColorStop(1, `rgba(60, 120, 200, 0)`);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = glowGrad;
      ctx.lineWidth = 4 + intensity * 4;
      ctx.stroke();
    }

    // Main stem line
    const stemGrad = ctx.createLinearGradient(x0, y0, x1, y1);
    stemGrad.addColorStop(0, `rgba(200, 220, 255, ${alpha})`);
    stemGrad.addColorStop(0.7, `rgba(160, 200, 240, ${alpha * 0.6})`);
    stemGrad.addColorStop(1, `rgba(120, 170, 220, 0)`);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = stemGrad;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bright tip glow on highlighted stems
    if (intensity > 0.3) {
      const tipX = centerX + Math.cos(angle) * outerR * 0.85;
      const tipY = centerY + Math.sin(angle) * outerR * 0.85;
      const tipGlow = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 8);
      tipGlow.addColorStop(0, `rgba(180, 220, 255, ${intensity * 0.5})`);
      tipGlow.addColorStop(1, 'rgba(100, 160, 220, 0)');
      ctx.beginPath();
      ctx.arc(tipX, tipY, 8, 0, Math.PI * 2);
      ctx.fillStyle = tipGlow;
      ctx.fill();
    }
  }
}
