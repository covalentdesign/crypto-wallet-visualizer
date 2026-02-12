export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  time: number
) {
  const spacing = 80;
  const pulseAlpha = Math.sin(time * 0.3) * 0.01 + 0.04;

  ctx.strokeStyle = `rgba(20, 80, 120, ${pulseAlpha})`;
  ctx.lineWidth = 0.5;

  // Vertical lines
  const startX = centerX % spacing;
  for (let x = startX; x < width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Horizontal lines
  const startY = centerY % spacing;
  for (let y = startY; y < height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Brighter lines at center crosshair
  ctx.strokeStyle = `rgba(30, 120, 180, ${pulseAlpha * 2})`;
  ctx.lineWidth = 0.8;

  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
}
