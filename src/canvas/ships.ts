import type { Planet, Ship } from '../types';

export function createShips(
  planets: Planet[],
  centerX: number,
  centerY: number,
  timelineRange?: { start: number; end: number }
): Ship[] {
  const ships: Ship[] = [];

  for (const planet of planets) {
    // Create ships based on transaction direction and count
    const outboundCount = Math.min(planet.interaction.sentCount, 3);
    const inboundCount = Math.min(planet.interaction.receivedCount, 3);

    // Calculate when this planet's ships should activate on the timeline
    let activationTime = 0;
    if (timelineRange) {
      const firstDate = new Date(planet.interaction.firstInteraction).getTime();
      const range = timelineRange.end - timelineRange.start;
      if (range > 0) {
        activationTime = Math.max(0, Math.min(1, (firstDate - timelineRange.start) / range));
      }
    }

    for (let i = 0; i < outboundCount; i++) {
      ships.push({
        fromX: centerX,
        fromY: centerY,
        toX: planet.x,
        toY: planet.y,
        progress: Math.random(), // Start at random position along path
        speed: 0.003 + Math.random() * 0.004,
        color: '#ff9944',
        trail: [],
        direction: 'outbound',
        chain: planet.interaction.primaryChain,
        activationTime,
      });
    }

    for (let i = 0; i < inboundCount; i++) {
      ships.push({
        fromX: planet.x,
        fromY: planet.y,
        toX: centerX,
        toY: centerY,
        progress: Math.random(),
        speed: 0.003 + Math.random() * 0.004,
        color: '#44ccff',
        trail: [],
        direction: 'inbound',
        chain: planet.interaction.primaryChain,
        activationTime,
      });
    }
  }

  return ships;
}

export function updateShips(
  ships: Ship[],
  planets: Planet[],
  centerX: number,
  centerY: number,
  trailsEnabled: boolean = true
) {
  let planetIdx = 0;
  for (const ship of ships) {
    ship.progress += ship.speed;
    if (ship.progress > 1) {
      ship.progress = 0;
      ship.trail = [];
    }

    // Update from/to based on current planet position
    const planet = planets[planetIdx % planets.length];
    if (planet) {
      if (ship.direction === 'outbound') {
        ship.fromX = centerX;
        ship.fromY = centerY;
        ship.toX = planet.x;
        ship.toY = planet.y;
      } else {
        ship.fromX = planet.x;
        ship.fromY = planet.y;
        ship.toX = centerX;
        ship.toY = centerY;
      }
    }

    // Current position with a slight curve
    const t = ship.progress;
    const midX = (ship.fromX + ship.toX) / 2;
    const midY = (ship.fromY + ship.toY) / 2;
    const dx = ship.toX - ship.fromX;
    const dy = ship.toY - ship.fromY;
    // Perpendicular offset for curve
    const perpX = -dy * 0.15;
    const perpY = dx * 0.15;
    const controlX = midX + perpX;
    const controlY = midY + perpY;

    // Quadratic bezier
    const x = (1 - t) * (1 - t) * ship.fromX + 2 * (1 - t) * t * controlX + t * t * ship.toX;
    const y = (1 - t) * (1 - t) * ship.fromY + 2 * (1 - t) * t * controlY + t * t * ship.toY;

    if (trailsEnabled) {
      // Add to trail
      ship.trail.push({ x, y, alpha: 1 });

      // Fade trail
      for (const point of ship.trail) {
        point.alpha -= 0.03;
      }
      ship.trail = ship.trail.filter((p) => p.alpha > 0);
    } else {
      // No trail — just keep the current head position
      ship.trail = [{ x, y, alpha: 1 }];
    }

    // Track which planet this ship belongs to
    if (ship.direction === 'outbound') {
      planetIdx++;
    } else {
      planetIdx++;
    }
  }

  // Re-associate ships with planets correctly
  reassociateShips(ships, planets, centerX, centerY);
}

function reassociateShips(
  ships: Ship[],
  planets: Planet[],
  centerX: number,
  centerY: number
) {
  let outIdx = 0;
  let inIdx = 0;

  for (const ship of ships) {
    if (ship.direction === 'outbound') {
      const pi = outIdx % planets.length;
      const planet = planets[pi];
      if (planet) {
        ship.fromX = centerX;
        ship.fromY = centerY;
        ship.toX = planet.x;
        ship.toY = planet.y;
      }
      outIdx++;
    } else {
      const pi = inIdx % planets.length;
      const planet = planets[pi];
      if (planet) {
        ship.fromX = planet.x;
        ship.fromY = planet.y;
        ship.toX = centerX;
        ship.toY = centerY;
      }
      inIdx++;
    }
  }
}

export function drawShips(ctx: CanvasRenderingContext2D, ships: Ship[], disabledChains?: Set<string>, trailsEnabled: boolean = true, timelineProgress?: number) {
  for (const ship of ships) {
    const disabled = disabledChains?.has(ship.chain) ?? false;
    if (disabled) continue;

    // Hide ships whose interaction hasn't occurred yet on the timeline
    if (timelineProgress !== undefined && timelineProgress < ship.activationTime) continue;

    // Draw trail (only when enabled)
    if (trailsEnabled) {
      for (const point of ship.trail) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = ship.direction === 'outbound'
          ? `rgba(255, 153, 68, ${point.alpha * 0.6})`
          : `rgba(68, 204, 255, ${point.alpha * 0.6})`;
        ctx.fill();
      }
    }

    // Draw ship (bright dot at head)
    if (ship.trail.length > 0) {
      const head = ship.trail[ship.trail.length - 1];
      if (head) {
        // Glow
        const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 3);
        glow.addColorStop(0, ship.direction === 'outbound'
          ? 'rgba(255, 180, 80, 0.6)'
          : 'rgba(80, 200, 255, 0.6)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(head.x, head.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(head.x, head.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = ship.direction === 'outbound' ? '#ffcc88' : '#88ddff';
        ctx.fill();
      }
    }

  }
}
