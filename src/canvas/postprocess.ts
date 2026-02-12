// WebGL post-processing: bloom, depth-of-field, vignette, chromatic aberration, film grain

// --- Shader sources ---

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const BRIGHT_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_threshold;
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(u_threshold, u_threshold + 0.25, lum);
  gl_FragColor = vec4(c.rgb * w, 1.0);
}`;

const BLUR_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_dir;
void main() {
  vec4 s = vec4(0.0);
  s += texture2D(u_tex, v_uv + u_dir * -4.0) * 0.0162;
  s += texture2D(u_tex, v_uv + u_dir * -3.0) * 0.0540;
  s += texture2D(u_tex, v_uv + u_dir * -2.0) * 0.1216;
  s += texture2D(u_tex, v_uv + u_dir * -1.0) * 0.1945;
  s += texture2D(u_tex, v_uv)                 * 0.2270;
  s += texture2D(u_tex, v_uv + u_dir *  1.0) * 0.1945;
  s += texture2D(u_tex, v_uv + u_dir *  2.0) * 0.1216;
  s += texture2D(u_tex, v_uv + u_dir *  3.0) * 0.0540;
  s += texture2D(u_tex, v_uv + u_dir *  4.0) * 0.0162;
  gl_FragColor = s;
}`;

const COMPOSITE_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform sampler2D u_dof;
uniform float u_bloomIntensity;
uniform float u_dofAmount;
uniform float u_time;
void main() {
  vec2 center = vec2(0.5);
  vec2 toEdge = v_uv - center;
  float dist = length(toEdge);

  // Chromatic aberration — subtle, increases toward edges
  float aberr = dist * dist * 0.003;
  vec2 rOff = toEdge * aberr;
  float r = texture2D(u_scene, v_uv + rOff).r;
  float g = texture2D(u_scene, v_uv).g;
  float b = texture2D(u_scene, v_uv - rOff).b;
  vec3 color = vec3(r, g, b);

  // Depth of field — blur increases with distance from center (sun)
  vec3 blurred = texture2D(u_dof, v_uv).rgb;
  float dofMix = smoothstep(0.1, 0.55, dist) * u_dofAmount;
  color = mix(color, blurred, dofMix);

  // Bloom (additive)
  vec3 bloom = texture2D(u_bloom, v_uv).rgb;
  color += bloom * u_bloomIntensity;

  // Vignette
  float vig = 1.0 - dist * dist * 0.9;
  color *= clamp(vig, 0.0, 1.0);

  // Film grain
  float grain = fract(sin(dot(v_uv * u_time * 0.01, vec2(12.9898, 78.233))) * 43758.5453);
  color += (grain - 0.5) * 0.025;

  gl_FragColor = vec4(color, 1.0);
}`;

// --- WebGL helpers ---

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader compile: ${log}`);
  }
  return s;
}

function link(gl: WebGLRenderingContext, vSrc: string, fSrc: string): WebGLProgram {
  const vs = compile(gl, gl.VERTEX_SHADER, vSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fSrc);
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'a_pos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Program link: ${gl.getProgramInfoLog(p)}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return p;
}

interface FBO {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

function makeFBO(gl: WebGLRenderingContext, w: number, h: number): FBO {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, tex, w, h };
}

// --- Post-processor ---

export interface PostProcessor {
  gl: WebGLRenderingContext;
  quad: WebGLBuffer;
  srcTex: WebGLTexture;
  bright: {
    prog: WebGLProgram;
    u_tex: WebGLUniformLocation | null;
    u_threshold: WebGLUniformLocation | null;
  };
  blur: {
    prog: WebGLProgram;
    u_tex: WebGLUniformLocation | null;
    u_dir: WebGLUniformLocation | null;
  };
  comp: {
    prog: WebGLProgram;
    u_scene: WebGLUniformLocation | null;
    u_bloom: WebGLUniformLocation | null;
    u_dof: WebGLUniformLocation | null;
    u_bloomIntensity: WebGLUniformLocation | null;
    u_dofAmount: WebGLUniformLocation | null;
    u_time: WebGLUniformLocation | null;
  };
  bloomA: FBO;
  bloomB: FBO;
  dofA: FBO;
  dofB: FBO;
}

export function createPostProcessor(gl: WebGLRenderingContext, w: number, h: number): PostProcessor {
  // Flip Y so canvas texture is right-side up
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

  // Full-screen quad
  const quad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  // Source texture (updated each frame from 2D canvas)
  const srcTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Compile programs
  const bp = link(gl, VERT, BRIGHT_FRAG);
  const blp = link(gl, VERT, BLUR_FRAG);
  const cp = link(gl, VERT, COMPOSITE_FRAG);

  // FBOs: bloom at half res, DOF at quarter res
  const hw = Math.max(1, w >> 1);
  const hh = Math.max(1, h >> 1);
  const qw = Math.max(1, w >> 2);
  const qh = Math.max(1, h >> 2);

  return {
    gl,
    quad,
    srcTex,
    bright: {
      prog: bp,
      u_tex: gl.getUniformLocation(bp, 'u_tex'),
      u_threshold: gl.getUniformLocation(bp, 'u_threshold'),
    },
    blur: {
      prog: blp,
      u_tex: gl.getUniformLocation(blp, 'u_tex'),
      u_dir: gl.getUniformLocation(blp, 'u_dir'),
    },
    comp: {
      prog: cp,
      u_scene: gl.getUniformLocation(cp, 'u_scene'),
      u_bloom: gl.getUniformLocation(cp, 'u_bloom'),
      u_dof: gl.getUniformLocation(cp, 'u_dof'),
      u_bloomIntensity: gl.getUniformLocation(cp, 'u_bloomIntensity'),
      u_dofAmount: gl.getUniformLocation(cp, 'u_dofAmount'),
      u_time: gl.getUniformLocation(cp, 'u_time'),
    },
    bloomA: makeFBO(gl, hw, hh),
    bloomB: makeFBO(gl, hw, hh),
    dofA: makeFBO(gl, qw, qh),
    dofB: makeFBO(gl, qw, qh),
  };
}

function drawQuad(pp: PostProcessor) {
  const { gl, quad } = pp;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function setTarget(gl: WebGLRenderingContext, fbo: FBO | null) {
  if (fbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fb);
    gl.viewport(0, 0, fbo.w, fbo.h);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }
}

export function applyPostProcessing(pp: PostProcessor, source: HTMLCanvasElement, time: number) {
  const { gl, srcTex } = pp;

  // Upload 2D canvas to source texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

  // --- 1. Extract bright pixels → bloomA (half res) ---
  gl.useProgram(pp.bright.prog);
  gl.uniform1i(pp.bright.u_tex, 0);
  gl.uniform1f(pp.bright.u_threshold, 0.35);
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  setTarget(gl, pp.bloomA);
  drawQuad(pp);

  // --- 2. Bloom blur: 3 iterations of H+V with progressive widening ---
  gl.useProgram(pp.blur.prog);
  gl.uniform1i(pp.blur.u_tex, 0);

  for (let i = 0; i < 3; i++) {
    const scale = 1.0 + i * 0.5; // 1.0, 1.5, 2.0 — progressively wider

    // H blur: bloomA → bloomB
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pp.bloomA.tex);
    gl.uniform2f(pp.blur.u_dir, scale / pp.bloomA.w, 0);
    setTarget(gl, pp.bloomB);
    drawQuad(pp);

    // V blur: bloomB → bloomA
    gl.bindTexture(gl.TEXTURE_2D, pp.bloomB.tex);
    gl.uniform2f(pp.blur.u_dir, 0, scale / pp.bloomB.h);
    setTarget(gl, pp.bloomA);
    drawQuad(pp);
  }
  // Bloom result in bloomA

  // --- 3. DOF: downsample + blur at quarter res ---
  // Downsample source → dofA (blur shader with zero direction = passthrough)
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.uniform2f(pp.blur.u_dir, 0, 0);
  setTarget(gl, pp.dofA);
  drawQuad(pp);

  // H blur: dofA → dofB (wider kernel for more DOF)
  gl.bindTexture(gl.TEXTURE_2D, pp.dofA.tex);
  gl.uniform2f(pp.blur.u_dir, 1.5 / pp.dofA.w, 0);
  setTarget(gl, pp.dofB);
  drawQuad(pp);

  // V blur: dofB → dofA
  gl.bindTexture(gl.TEXTURE_2D, pp.dofB.tex);
  gl.uniform2f(pp.blur.u_dir, 0, 1.5 / pp.dofB.h);
  setTarget(gl, pp.dofA);
  drawQuad(pp);

  // --- 4. Final composite → screen ---
  gl.useProgram(pp.comp.prog);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.uniform1i(pp.comp.u_scene, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, pp.bloomA.tex);
  gl.uniform1i(pp.comp.u_bloom, 1);

  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, pp.dofA.tex);
  gl.uniform1i(pp.comp.u_dof, 2);

  gl.uniform1f(pp.comp.u_bloomIntensity, 0.7);
  gl.uniform1f(pp.comp.u_dofAmount, 0.4);
  gl.uniform1f(pp.comp.u_time, time);

  setTarget(gl, null); // render to screen
  drawQuad(pp);
}
