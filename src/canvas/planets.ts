import type { Camera, Planet, WalletInteraction } from '../types';

const CHAIN_COLORS: Record<string, { fill: string; glow: string }> = {
  'eth-mainnet': { fill: '#627EEA', glow: 'rgba(98, 126, 234, 0.4)' },
  'matic-mainnet': { fill: '#8247E5', glow: 'rgba(130, 71, 229, 0.4)' },
  'polygon-mainnet': { fill: '#8247E5', glow: 'rgba(130, 71, 229, 0.4)' },
  'arbitrum-mainnet': { fill: '#28A0F0', glow: 'rgba(40, 160, 240, 0.4)' },
  'base-mainnet': { fill: '#0052FF', glow: 'rgba(0, 82, 255, 0.4)' },
  'optimism-mainnet': { fill: '#FF0420', glow: 'rgba(255, 4, 32, 0.4)' },
  'bsc-mainnet': { fill: '#F0B90B', glow: 'rgba(240, 185, 11, 0.4)' },
  'avalanche-mainnet': { fill: '#E84142', glow: 'rgba(232, 65, 66, 0.4)' },
  'fantom-mainnet': { fill: '#1969FF', glow: 'rgba(25, 105, 255, 0.4)' },
  default: { fill: '#4ECDC4', glow: 'rgba(78, 205, 196, 0.4)' },
};

// Each chain gets a unique orbital plane — like atomic electron shells
const CHAIN_PLANES: Record<string, { tiltX: number; tiltZ: number }> = {
  'eth-mainnet':       { tiltX: 0,               tiltZ: 0 },                // flat horizontal (XY)
  'base-mainnet':      { tiltX: Math.PI * 0.38,  tiltZ: 0 },               // tilted ~68° forward
  'bsc-mainnet':       { tiltX: Math.PI * 0.25,  tiltZ: Math.PI * 0.5 },   // 45° tilt, rotated 90°
  'matic-mainnet':     { tiltX: Math.PI * 0.35,  tiltZ: Math.PI * 0.33 },  // ~63° tilt, rotated 60°
  'polygon-mainnet':   { tiltX: Math.PI * 0.35,  tiltZ: Math.PI * 0.33 },
  'arbitrum-mainnet':  { tiltX: Math.PI * 0.2,   tiltZ: Math.PI * 0.67 },  // ~36° tilt, rotated 120°
  'optimism-mainnet':  { tiltX: Math.PI * 0.42,  tiltZ: Math.PI * 0.17 },  // ~76° tilt, rotated 30°
  'avalanche-mainnet': { tiltX: Math.PI * 0.15,  tiltZ: Math.PI * 0.83 },  // ~27° tilt, rotated 150°
  'fantom-mainnet':    { tiltX: Math.PI * 0.3,   tiltZ: Math.PI * 0.5 },   // ~54° tilt, rotated 90°
};

const DEFAULT_PLANE = { tiltX: Math.PI * 0.1, tiltZ: 0 };

function getChainColor(chain: string) {
  return CHAIN_COLORS[chain] ?? CHAIN_COLORS.default;
}

function getChainPlane(chain: string) {
  return CHAIN_PLANES[chain] ?? DEFAULT_PLANE;
}

export function createPlanets(
  interactions: WalletInteraction[],
  centerX: number,
  centerY: number,
  _width: number,
  height: number
): Planet[] {
  const minOrbit = 100;
  const maxOrbit = Math.min(height * 0.42, 500);
  const orbitStep = interactions.length > 1
    ? (maxOrbit - minOrbit) / (interactions.length - 1)
    : 0;

  return interactions.map((interaction, i) => {
    const orbitRadius = minOrbit + orbitStep * i;
    const angle = (i / interactions.length) * Math.PI * 2 + Math.random() * 0.5;
    const angularSpeed = (0.15 + Math.random() * 0.1) / (i + 1);

    const maxTx = Math.max(...interactions.map((w) => w.txCount));
    const sizeRatio = interaction.txCount / (maxTx || 1);
    const size = 6 + sizeRatio * 18;

    const colors = getChainColor(interaction.primaryChain);
    const plane = getChainPlane(interaction.primaryChain);

    return {
      interaction,
      orbitRadius,
      angle,
      angularSpeed,
      size,
      color: colors.fill,
      glowColor: colors.glow,
      x: centerX + Math.cos(angle) * orbitRadius,
      y: centerY + Math.sin(angle) * orbitRadius,
      z: 0,
      hovered: false,
      planeTiltX: plane.tiltX,
      planeTiltZ: plane.tiltZ,
    };
  });
}

/**
 * Project a point on a tilted orbital plane into screen space.
 * 1) Start on the flat circle: (cos(a)*r, sin(a)*r, 0)
 * 2) Rotate by chain's plane orientation (tiltX, tiltZ)
 * 3) Apply camera rotation (rotationY, tiltX)
 * 4) Return screen x, y and depth z
 */
export function projectOrbitPoint(
  angle: number,
  orbitRadius: number,
  planeTiltX: number,
  planeTiltZ: number,
  centerX: number,
  centerY: number,
  camera: Camera
): { x: number; y: number; z: number } {
  // Start on flat circle
  let x = Math.cos(angle) * orbitRadius;
  let y = Math.sin(angle) * orbitRadius;
  let z = 0;

  // Rotate around X axis by planeTiltX (tilts the plane forward/backward)
  {
    const c = Math.cos(planeTiltX);
    const s = Math.sin(planeTiltX);
    const ny = y * c - z * s;
    const nz = y * s + z * c;
    y = ny;
    z = nz;
  }

  // Rotate around Z axis by planeTiltZ (rotates the plane's orientation)
  {
    const c = Math.cos(planeTiltZ);
    const s = Math.sin(planeTiltZ);
    const nx = x * c - y * s;
    const ny = x * s + y * c;
    x = nx;
    y = ny;
  }

  // Apply camera Y rotation (horizontal drag)
  {
    const c = Math.cos(camera.rotationY);
    const s = Math.sin(camera.rotationY);
    const nx = x * c - z * s;
    const nz = x * s + z * c;
    x = nx;
    z = nz;
  }

  // Apply camera X tilt (vertical drag)
  {
    const c = Math.cos(camera.tiltX);
    const s = Math.sin(camera.tiltX);
    const ny = y * c - z * s;
    const nz = y * s + z * c;
    y = ny;
    z = nz;
  }

  return {
    x: centerX + x,
    y: centerY + y,
    z,
  };
}

/** Parse hex color to r,g,b */
function hexToRgb(hex: string): [number, number, number] {
  const num = parseInt(hex.replace('#', ''), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function drawPlanets(
  ctx: CanvasRenderingContext2D,
  planets: Planet[],
  _time: number,
  centerX: number,
  centerY: number,
  camera: Camera,
  disabledChains?: Set<string>
) {
  // Update positions and z-depth
  const sorted: { planet: Planet; z: number }[] = [];

  for (const planet of planets) {
    planet.angle += planet.angularSpeed * 0.016;
    const proj = projectOrbitPoint(
      planet.angle, planet.orbitRadius,
      planet.planeTiltX, planet.planeTiltZ,
      centerX, centerY, camera
    );
    planet.x = proj.x;
    planet.y = proj.y;
    planet.z = proj.z;
    sorted.push({ planet, z: proj.z });
  }

  // Z-sort: draw back-to-front
  sorted.sort((a, b) => b.z - a.z);

  for (const { planet, z } of sorted) {
    const { x, y, size, color, hovered } = planet;

    const disabled = disabledChains?.has(planet.interaction.primaryChain) ?? false;
    if (disabled) continue;

    // Depth dimming
    const depthAlpha = Math.max(0.4, 1 - z / 600);
    const depthScale = 0.8 + 0.2 * depthAlpha;
    const r = size * depthScale;

    // Direction from planet to sun (light source)
    const dx = centerX - x;
    const dy = centerY - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const lightDirX = dx / dist;
    const lightDirY = dy / dist;

    // Light offset: the highlight is shifted toward the sun
    const lightOffX = lightDirX * r * 0.45;
    const lightOffY = lightDirY * r * 0.45;

    // Shadow offset: opposite side
    const shadowOffX = -lightDirX * r * 0.3;
    const shadowOffY = -lightDirY * r * 0.3;

    const [cr, cg, cb] = hexToRgb(color);

    ctx.globalAlpha = depthAlpha;

    // Ambient glow from sun light hitting the planet
    const ambientSize = hovered ? r * 3.5 : r * 2;
    const ambient = ctx.createRadialGradient(
      x + lightOffX * 0.5, y + lightOffY * 0.5, 0,
      x, y, ambientSize
    );
    ambient.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0.2)`);
    ambient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(x, y, ambientSize, 0, Math.PI * 2);
    ctx.fillStyle = ambient;
    ctx.fill();

    // Planet base — dark body
    const baseGrad = ctx.createRadialGradient(
      x + shadowOffX, y + shadowOffY, 0,
      x, y, r
    );
    baseGrad.addColorStop(0, `rgb(${Math.floor(cr * 0.15)}, ${Math.floor(cg * 0.15)}, ${Math.floor(cb * 0.15)})`);
    baseGrad.addColorStop(1, `rgb(${Math.floor(cr * 0.25)}, ${Math.floor(cg * 0.25)}, ${Math.floor(cb * 0.25)})`);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = baseGrad;
    ctx.fill();

    // Lit side — gradient from sun direction
    const litGrad = ctx.createRadialGradient(
      x + lightOffX, y + lightOffY, 0,
      x + lightOffX, y + lightOffY, r * 1.6
    );
    litGrad.addColorStop(0, `rgba(${Math.min(255, cr + 80)}, ${Math.min(255, cg + 60)}, ${Math.min(255, cb + 40)}, 0.9)`);
    litGrad.addColorStop(0.3, `rgba(${cr}, ${cg}, ${cb}, 0.6)`);
    litGrad.addColorStop(0.7, `rgba(${Math.floor(cr * 0.4)}, ${Math.floor(cg * 0.4)}, ${Math.floor(cb * 0.4)}, 0.1)`);
    litGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = litGrad;
    ctx.fill();

    // Specular highlight — bright hot spot on the sun-facing edge
    const specX = x + lightDirX * r * 0.55;
    const specY = y + lightDirY * r * 0.55;
    const specGrad = ctx.createRadialGradient(specX, specY, 0, specX, specY, r * 0.4);
    specGrad.addColorStop(0, 'rgba(255, 255, 240, 0.5)');
    specGrad.addColorStop(0.4, 'rgba(255, 240, 200, 0.15)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    // Terminator line — subtle edge between lit and shadow
    const termGrad = ctx.createLinearGradient(
      x + lightOffX * 2, y + lightOffY * 2,
      x + shadowOffX * 2, y + shadowOffY * 2
    );
    termGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    termGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0)');
    termGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.3)');
    termGrad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = termGrad;
    ctx.fill();

    // Atmospheric glow — soft halo around the planet
    const atmosSize = r * 1.6;
    const atmosGrad = ctx.createRadialGradient(x, y, r * 0.85, x, y, atmosSize);
    atmosGrad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${0.15 * depthAlpha})`);
    atmosGrad.addColorStop(0.4, `rgba(${cr}, ${cg}, ${cb}, ${0.06 * depthAlpha})`);
    atmosGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(x, y, atmosSize, 0, Math.PI * 2);
    ctx.fillStyle = atmosGrad;
    ctx.fill();

    ctx.globalAlpha = 1;

    // Hover ring + label
    if (hovered) {
      ctx.beginPath();
      ctx.arc(x, y, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, 0.5)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      const label = planet.interaction.label || truncateAddress(planet.interaction.address);
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(200, 220, 255, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - r - 16);

      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(150, 180, 210, 0.7)';
      ctx.fillText(`${planet.interaction.txCount} txns · ${planet.interaction.primaryChain.replace('-mainnet', '')}`, x, y - r - 6);
    }
  }
}

function truncateAddress(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}
