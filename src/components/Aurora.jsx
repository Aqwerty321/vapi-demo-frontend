// React Bits Aurora by David Haz, adapted for Voice Lab.
// Original source and license: THIRD_PARTY_NOTICES.md.
import React, { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Color, Triangle } from "ogl";
import "./Aurora.css";

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uLightMode;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ), 
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  
  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);
  
  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);
  
  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;
  
  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  
  vec3 auroraColor = intensity * rampColor;
  // A narrow ridge gives the curtain definition without a flashing effect.
  float ribbon = exp(-pow((height - 0.24) * 5.0, 2.0));
  auroraColor += rampColor * ribbon * 0.28;
  auroraAlpha = max(auroraAlpha, ribbon * 0.42);
  
  if (uLightMode > 0.5) {
    float energy = clamp(max(intensity, 0.0), 0.0, 1.0);
    float coverage = clamp(auroraAlpha * (0.55 + 0.45 * energy), 0.0, 0.86);
    vec3 chroma = pow(clamp(rampColor, 0.0, 1.0), vec3(1.2));
    float chromaPeak = max(chroma.r, max(chroma.g, chroma.b));
    chroma /= max(chromaPeak, 0.0001);
    fragColor = vec4(mix(vec3(1.0), chroma, min(coverage * 1.08, 0.94)), 1.0);
  } else {
    fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
  }
}
`;


const DEFAULT_COLORS = ["#68518F", "#6F91B4", "#9872B5"];

export default function Aurora({
  colorStops = DEFAULT_COLORS,
  amplitude = 0.7,
  blend = 0.72,
  speed = 0.18,
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    let renderer;
    const fallback = () => container.classList.add("aurora-fallback");
    try {
      // This softly blended backdrop does not need device-resolution rendering.
      renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: false, dpr: 1 });
    } catch {
      fallback();
      return;
    }
    const gl = renderer.gl;
    if (!gl || !renderer.isWebgl2) {
      fallback();
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      return;
    }
    container.classList.remove("aurora-fallback");
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const geometry = new Triangle(gl);
    delete geometry.attributes.uv;
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 6 },
        uAmplitude: { value: amplitude },
        uColorStops: { value: colorStops.map(hex => [...new Color(hex)]) },
        uResolution: { value: [1, 1] },
        uBlend: { value: blend },
        uLightMode: { value: 0 },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });
    container.appendChild(gl.canvas);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastFrame = 0;
    let elapsed = 6;
    let lost = false;
    const render = () => {
      if (lost) return;
      program.uniforms.uTime.value = elapsed;
      renderer.render({ scene: mesh });
    };
    const tick = now => {
      frame = requestAnimationFrame(tick);
      const delta = now - lastFrame;
      // A 30 fps cap leaves room for the foreground orb and realtime audio.
      if (lastFrame && delta < 1000 / 30) return;
      elapsed += lastFrame ? Math.min(delta, 100) * 0.001 * speed : 0;
      lastFrame = now;
      render();
    };
    const syncAnimation = () => {
      cancelAnimationFrame(frame);
      lastFrame = 0;
      if (document.hidden || lost) return;
      render();
      if (!reducedMotion.matches) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height);
      program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height];
      if (!document.hidden) render();
    };
    const contextLost = () => {
      lost = true;
      cancelAnimationFrame(frame);
      fallback();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    document.addEventListener("visibilitychange", syncAnimation);
    reducedMotion.addEventListener("change", syncAnimation);
    gl.canvas.addEventListener("webglcontextlost", contextLost);
    resize();
    syncAnimation();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncAnimation);
      reducedMotion.removeEventListener("change", syncAnimation);
      gl.canvas.removeEventListener("webglcontextlost", contextLost);
      gl.canvas.remove();
      geometry.remove();
      gl.deleteProgram(program.program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [colorStops, amplitude, blend, speed]);

  return <div ref={containerRef} className="aurora-container" aria-hidden="true" />;
}
