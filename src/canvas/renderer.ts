import type { Planet, Ship, Star, WalletInteraction } from '../types';
import { createStarfield, drawStarfield } from './starfield';
import { drawGrid } from './grid';
import { drawSun } from './sun';
import { drawOrbits } from './orbits';
import { drawPlanets, createPlanets, projectOrbitPoint } from './planets';
import { drawShips, createShips, updateShips } from './ships';
import { createPostProcessor, applyPostProcessing, type PostProcessor } from './postprocess';
import { drawLoader } from './loader';

export interface RendererState {
  canvas: HTMLCanvasElement;
  offscreenCanvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  stars: Star[];
  planets: Planet[];
  ships: Ship[];
  time: number;
  mouseX: number;
  mouseY: number;
  hoveredPlanet: Planet | null;
  animationId: number | null;
  walletAddress: string | null;
  // 3D camera
  zoom: number;
  tiltX: number;       // vertical tilt of the orbital plane (drag up/down)
  rotationY: number;   // horizontal rotation offset (drag left/right)
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  dragStartTiltX: number;
  dragStartRotationY: number;
  dpr: number;
  // Background image
  bgImage: HTMLImageElement | null;
  bgLoaded: boolean;
  // Click callback
  onClickPlanet: ((planet: Planet | null) => void) | null;
  // WebGL post-processing
  postProcessor: PostProcessor | null;
  // Chain filter
  disabledChains: Set<string>;
  // Loading state
  loading: boolean;
  // Trails toggle
  trailsEnabled: boolean;
  // Timeline sync
  timelineRange: { start: number; end: number } | null;
  timelineProgress: number | undefined;
}

export function createRenderer(canvas: HTMLCanvasElement): RendererState {
  const width = canvas.width;
  const height = canvas.height;

  // Try WebGL for post-processing effects
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false });

  let ctx: CanvasRenderingContext2D;
  let offscreenCanvas: HTMLCanvasElement;
  let postProcessor: PostProcessor | null = null;

  if (gl) {
    // WebGL available — render 2D to offscreen canvas, post-process to main canvas
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    ctx = offscreenCanvas.getContext('2d')!;
    postProcessor = createPostProcessor(gl, canvas.width, canvas.height);
  } else {
    // Fallback — render 2D directly to main canvas (no post-processing)
    offscreenCanvas = canvas;
    ctx = canvas.getContext('2d')!;
  }

  const bgImage = new Image();
  bgImage.src = '/space.jpg';

  const state: RendererState = {
    canvas,
    offscreenCanvas,
    ctx,
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    stars: createStarfield(width, height, 10000),
    planets: [],
    ships: [],
    time: 0,
    mouseX: 0,
    mouseY: 0,
    hoveredPlanet: null,
    animationId: null,
    walletAddress: null,
    zoom: 1,
    tiltX: 0.35,       // slight default tilt for 3D depth feel
    rotationY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartTiltX: 0,
    dragStartRotationY: 0,
    dpr: window.devicePixelRatio || 1,
    bgImage,
    bgLoaded: false,
    onClickPlanet: null,
    postProcessor,
    disabledChains: new Set(),
    loading: false,
    trailsEnabled: true,
    timelineRange: null,
    timelineProgress: undefined,
  };

  bgImage.onload = () => { state.bgLoaded = true; };

  return state;
}

export function updateSize(state: RendererState) {
  state.dpr = window.devicePixelRatio || 1;
  state.width = window.innerWidth;
  state.height = window.innerHeight;

  const pw = state.width * state.dpr;
  const ph = state.height * state.dpr;

  state.canvas.width = pw;
  state.canvas.height = ph;
  state.canvas.style.width = state.width + 'px';
  state.canvas.style.height = state.height + 'px';

  // Resize offscreen canvas to match
  if (state.offscreenCanvas !== state.canvas) {
    state.offscreenCanvas.width = pw;
    state.offscreenCanvas.height = ph;
  }

  state.centerX = state.width / 2;
  state.centerY = state.height / 2;
  state.stars = createStarfield(state.width, state.height, 10000);

  // Canvas resize resets WebGL context — re-create post-processor
  if (state.postProcessor) {
    const gl = state.canvas.getContext('webgl', { alpha: false, antialias: false });
    if (gl) {
      state.postProcessor = createPostProcessor(gl, pw, ph);
    }
  }

}

export function setInteractions(
  state: RendererState,
  interactions: WalletInteraction[]
) {
  state.planets = createPlanets(interactions, state.centerX, state.centerY, state.width, state.height);
  state.ships = createShips(state.planets, state.centerX, state.centerY, state.timelineRange ?? undefined);
}

/** Convert screen coords to world coords for hit testing */
function screenToWorld(state: RendererState, sx: number, sy: number) {
  return {
    x: (sx - state.centerX) / state.zoom + state.centerX,
    y: (sy - state.centerY) / state.zoom + state.centerY,
  };
}

export function setupInteraction(state: RendererState) {
  const canvas = state.canvas;

  // Scroll to zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    state.zoom = Math.max(0.3, Math.min(8, state.zoom * zoomFactor));
  }, { passive: false });

  // Drag to rotate/tilt the 3D view
  let didDrag = false;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    state.isDragging = true;
    didDrag = false;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    state.dragStartTiltX = state.tiltX;
    state.dragStartRotationY = state.rotationY;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (state.isDragging) {
      const dx = e.clientX - state.dragStartX;
      const dy = e.clientY - state.dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
      // Horizontal drag = rotate the system
      state.rotationY = state.dragStartRotationY + dx * 0.005;
      // Vertical drag = tilt the orbital plane (unclamped for full rotation)
      state.tiltX = state.dragStartTiltX + dy * 0.005;
    }
  });

  window.addEventListener('mouseup', () => {
    if (state.isDragging && !didDrag && state.onClickPlanet) {
      // It was a click, not a drag — check if hovering a planet
      state.onClickPlanet(state.hoveredPlanet);
    }
    state.isDragging = false;
    canvas.style.cursor = 'default';
  });
}

export function startRenderLoop(
  state: RendererState,
  onHover: (planet: Planet | null) => void
) {
  function render() {
    state.time += 0.016;

    const { ctx, width, height, centerX, centerY, dpr } = state;

    // Reset transform and clear
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Draw space background with slight parallax
    if (state.bgLoaded && state.bgImage) {
      ctx.globalAlpha = 0.2;
      const img = state.bgImage;
      const imgRatio = img.width / img.height;
      const canvasRatio = width / height;
      // Cover the canvas maintaining aspect ratio, slightly oversized for parallax room
      const oversize = 1.15;
      let drawW: number, drawH: number;
      if (canvasRatio > imgRatio) {
        drawW = width * oversize;
        drawH = drawW / imgRatio;
      } else {
        drawH = height * oversize;
        drawW = drawH * imgRatio;
      }
      // Offset by dampened camera rotation for subtle parallax
      const px = -state.rotationY * 15;
      const py = -state.tiltX * 15;
      const drawX = (width - drawW) / 2 + px;
      const drawY = (height - drawH) / 2 + py;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.globalAlpha = 1;
    }

    // Draw starfield with parallax
    drawStarfield(ctx, state.stars, state.time, state.rotationY, state.tiltX);

    // Apply zoom transform (sun stays at center)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-centerX, -centerY);

    // Pass tilt and rotation to all draw functions
    const camera = { tiltX: state.tiltX, rotationY: state.rotationY };

    drawGrid(ctx, width, height, centerX, centerY, state.time);
    drawOrbits(ctx, state.planets, centerX, centerY, state.time, camera, state.disabledChains);
    drawSun(ctx, centerX, centerY, state.time);

    // Starburst loader while fetching data
    if (state.loading) {
      drawLoader(ctx, centerX, centerY, state.time);
    }

    drawPlanets(ctx, state.planets, state.time, centerX, centerY, camera, state.disabledChains);

    updateShips(state.ships, state.planets, centerX, centerY, state.trailsEnabled);
    drawShips(ctx, state.ships, state.disabledChains, state.trailsEnabled, state.timelineProgress);

    ctx.restore();

    // Apply WebGL post-processing (bloom, DOF, vignette, chromatic aberration)
    if (state.postProcessor) {
      applyPostProcessing(state.postProcessor, state.offscreenCanvas, state.time);
    }

    // Hit test in world coords — check planets first, then orbits
    const world = screenToWorld(state, state.mouseX, state.mouseY);
    let found: Planet | null = null;

    // Pass 1: planet bodies (highest priority, skip disabled chains)
    for (const planet of state.planets) {
      if (state.disabledChains.has(planet.interaction.primaryChain)) continue;
      const dx = world.x - planet.x;
      const dy = world.y - planet.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < planet.size + 12) {
        found = planet;
      }
    }

    // Pass 2: orbit paths (if no planet body was hit, skip disabled chains)
    if (!found) {
      const orbitThreshold = 10 / state.zoom;
      const orbitSamples = 60;
      let closestDist = Infinity;

      for (const planet of state.planets) {
        if (state.disabledChains.has(planet.interaction.primaryChain)) continue;
        for (let i = 0; i < orbitSamples; i++) {
          const a = (i / orbitSamples) * Math.PI * 2;
          const pt = projectOrbitPoint(
            a, planet.orbitRadius,
            planet.planeTiltX, planet.planeTiltZ,
            centerX, centerY, camera
          );
          const dx = world.x - pt.x;
          const dy = world.y - pt.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < orbitThreshold && dist < closestDist) {
            closestDist = dist;
            found = planet;
          }
        }
      }
    }

    for (const planet of state.planets) {
      planet.hovered = planet === found;
    }

    if (found !== state.hoveredPlanet) {
      state.hoveredPlanet = found;
      onHover(found);
    }

    state.animationId = requestAnimationFrame(render);
  }

  render();
}

export function stopRenderLoop(state: RendererState) {
  if (state.animationId !== null) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }
}
