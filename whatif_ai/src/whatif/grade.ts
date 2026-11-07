// VIRUS2027 grade: warm monochrome everywhere, signal orange is the only hue that keeps its saturation.
import { Effect, BlendFunction } from "postprocessing";
import { Uniform } from "three";

const FRAG = /* glsl */ `
uniform float sat;      // saturation kept outside the orange band
uniform float contrast;
uniform float lift;
uniform float warm;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // orange mask: red well above green and blue (signal #FF531F, glows, Vira)
  float rg = c.r - c.g, rb = c.r - c.b;
  float orange = smoothstep(0.10, 0.35, rg / max(c.r, 1e-3)) * smoothstep(0.35, 0.6, rb / max(c.r, 1e-3)) * smoothstep(0.015, 0.08, l);
  vec3 mono = l * vec3(1.0 + 0.06 * warm, 1.0, 1.0 - 0.10 * warm);
  vec3 o = mix(mono, c, mix(sat, 1.0, orange));
  // gentle S-curve around mid grey in display-ish space
  vec3 g = pow(o, vec3(1.0 / 2.2));
  g = (g - 0.5) * contrast + 0.5 + lift;
  g = clamp(g, 0.0, 1.0);
  outputColor = vec4(pow(g, vec3(2.2)), inputColor.a);
}`;

export class GradeEffect extends Effect {
  constructor({ sat = 0.32, contrast = 1.1, lift = 0.012, warm = 1 } = {}) {
    super("V27Grade", FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([["sat", new Uniform(sat)], ["contrast", new Uniform(contrast)], ["lift", new Uniform(lift)], ["warm", new Uniform(warm)]]),
    });
  }
}
