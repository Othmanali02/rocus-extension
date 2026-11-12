/**
 * rocus-swirl.js — Rocus logo animation
 *
 * Sequence: hold → curl into a ring → spin twice → unroll back into the logo
 * while sliding right, revealing space (and an optional slot) for text on the left.
 *
 * Two ways to use it:
 *   1. <rocus-swirl> custom element (any web framework, or plain HTML)
 *   2. createRocusSwirl() — pure, framework-free frame math (canvas, React Native,
 *      Skia, or as a reference when porting to Swift/Kotlin/Flutter)
 *
 * No dependencies. Safe to import during SSR (the element only registers in a browser).
 */

// Centerline of the swirl, traced from RocusSwirlBlue.png (839×1076 px space).
// Ordered from the outer tail (bottom right) to the inner end.
export const ROCUS_POINTS = [[717.0,1036.0],[699.7,1034.6],[682.3,1033.3],[665.0,1031.9],[647.7,1030.1],[630.4,1028.3],[613.2,1025.8],[595.9,1023.5],[578.8,1020.3],[561.7,1017.2],[544.8,1013.4],[527.8,1009.5],[510.9,1005.2],[494.2,1000.4],[477.6,995.5],[461.0,990.1],[444.7,984.2],[428.3,978.2],[412.2,971.8],[396.2,964.9],[380.4,957.7],[364.7,950.1],[349.2,942.3],[333.9,933.9],[318.8,925.4],[303.9,916.3],[289.2,907.1],[274.8,897.3],[260.7,887.2],[246.8,876.7],[233.2,865.9],[219.9,854.7],[206.8,843.2],[194.2,831.2],[181.9,818.9],[169.8,806.5],[158.1,793.6],[146.9,780.3],[136.1,766.6],[125.8,752.6],[116.1,738.2],[106.6,723.6],[97.6,708.7],[89.3,693.4],[81.6,677.8],[74.4,662.0],[67.9,645.9],[61.9,629.6],[56.7,613.0],[52.3,596.2],[48.5,579.2],[45.5,562.1],[43.4,544.8],[42.1,527.4],[41.0,510.1],[40.8,492.7],[41.5,475.3],[42.7,458.0],[44.2,440.7],[46.6,423.4],[49.6,406.3],[53.1,389.3],[57.3,372.4],[61.7,355.6],[67.0,339.0],[72.5,322.5],[78.9,306.3],[85.4,290.2],[92.6,274.4],[100.4,258.8],[108.5,243.4],[117.1,228.3],[126.5,213.7],[136.1,199.2],[146.4,185.2],[157.2,171.6],[168.6,158.4],[180.4,145.7],[192.8,133.4],[205.5,121.6],[218.8,110.3],[232.6,99.8],[247.0,90.0],[261.9,81.0],[277.2,72.8],[293.0,65.4],[309.1,59.0],[325.6,53.5],[342.4,49.0],[359.5,45.6],[376.7,43.0],[394.0,41.4],[411.3,40.2],[428.7,40.4],[446.1,41.6],[463.4,43.1],[480.6,45.6],[497.7,48.8],[514.6,52.7],[531.4,57.4],[547.9,62.8],[564.2,68.9],[580.2,75.7],[596.0,83.0],[611.5,91.0],[626.6,99.5],[641.3,108.9],[655.7,118.6],[669.6,129.0],[683.1,140.0],[696.1,151.6],[708.5,163.7],[720.3,176.5],[731.6,189.8],[742.2,203.6],[752.0,217.9],[760.9,232.8],[769.0,248.3],[776.1,264.1],[782.2,280.4],[787.2,297.0],[791.2,314.0],[793.8,331.2],[795.8,348.4],[796.9,365.8],[796.4,383.2],[794.9,400.5],[792.5,417.7],[789.4,434.8],[785.1,451.7],[779.8,468.2],[773.7,484.5],[766.6,500.4],[758.8,515.9],[750.1,531.0],[740.7,545.6],[730.7,559.9],[720.0,573.6],[708.7,586.8],[696.6,599.3],[684.0,611.3],[670.7,622.5],[656.9,633.1],[642.6,643.0],[627.9,652.3],[612.7,660.6],[597.0,668.1],[580.9,674.7],[564.4,680.3],[547.6,684.9],[530.6,688.4],[513.4,690.8],[496.1,692.4],[478.7,693.0],[461.3,692.1],[444.0,690.4],[426.8,687.7],[409.9,683.9],[393.3,678.8],[377.1,672.5],[361.4,665.0],[346.2,656.5],[331.7,646.9],[317.9,636.3],[304.9,624.7],[292.6,612.4],[281.2,599.3],[270.7,585.4],[261.2,570.9],[252.6,555.8],[245.1,540.1],[238.7,523.9],[233.3,507.4],[229.0,490.5],[225.9,473.4],[224.0,456.1],[222.6,438.8],[222.7,421.4],[224.3,404.1],[226.5,386.9],[230.1,369.9],[235.1,353.2],[241.6,337.1],[249.4,321.6],[258.6,306.8],[269.1,292.9],[280.9,280.1],[293.4,268.0],[306.8,257.0],[321.3,247.4],[336.6,239.1],[352.6,232.4],[369.2,227.1],[386.2,223.5],[403.4,221.2],[420.7,219.8],[438.1,220.7],[455.4,222.9],[472.4,226.4],[488.9,231.8],[504.6,239.3],[519.4,248.5],[532.9,259.3],[545.3,271.6],[556.4,285.0],[565.8,299.6],[573.6,315.1],[579.6,331.4],[583.9,348.2],[586.6,365.4],[588.3,382.7],[587.4,400.1],[584.9,417.3],[580.9,434.2],[574.8,450.4],[566.3,465.6],[555.9,479.5],[543.5,491.7],[529.4,501.9],[513.9,509.8],[497.4,515.2],[480.3,518.2],[463.0,519.8],[445.7,518.1],[428.6,514.9],[412.2,509.2],[397.3,500.3],[384.1,488.9],[372.7,475.9],[364.4,460.6],[360.0,443.8],[357.3,426.6],[358.6,409.4],[362.1,392.3],[368.7,376.3],[379.3,362.5],[392.0,350.7],[405.7,339.9],[421.1,332.1],[438.0,328.0]];

export const ROCUS_DEFAULTS = Object.freeze({
  color: "#4A90E2",
  strokeWidth: 80,             // stroke width in logo px (original logo)
  logoSize: [839, 1076],       // original logo bounds
  stage: [2200, 1300],         // viewBox of the full animation, incl. text space
  center: [477, 412],          // spiral centre in logo px
  ringRadius: 200,             // radius the swirl collapses to
  twist: 0.4,                  // extra wind-in for outer points while curling (radians per ringRadius)
  stagger: 0.35,               // 0..1, how much earlier the tail curls than the inner end
  spins: 2,
  finalRight: 2080,            // x of the logo's right edge after sliding (stage px)
  textArea: [160, 470, 1000, 360], // x, y, w, h (stage px) where text goes
  timeline: { hold: 600, curl: 1400, spin: 1800, unroll: 1900, rest: 1300 },
});

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeInOutCubic = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Build an animation instance. All times are in milliseconds.
 * Options override ROCUS_DEFAULTS (timeline is merged key-by-key).
 */
export function createRocusSwirl(options = {}) {
  const cfg = { ...ROCUS_DEFAULTS, ...options, timeline: { ...ROCUS_DEFAULTS.timeline, ...(options.timeline || {}) } };
  const { center: C, ringRadius: R, twist, stagger, timeline: tl, stage, logoSize } = cfg;

  const phases = ["hold", "curl", "spin", "unroll", "rest"];
  const starts = {}; let acc = 0;
  for (const p of phases) { starts[p] = acc; acc += tl[p]; }
  const duration = acc;                              // full loop length (includes rest)
  const playDuration = duration - tl.rest;           // one-shot length (logo fully settled)

  // Polar form of the centerline around the spiral centre, angles unwrapped.
  const N = ROCUS_POINTS.length;
  const polar = ROCUS_POINTS.map(([x, y], i) => ({ r: Math.hypot(x - C[0], y - C[1]), a: Math.atan2(y - C[1], x - C[0]), s: i / (N - 1) }));
  for (let i = 1; i < N; i++) {
    let d = polar[i].a - polar[i - 1].a;
    while (d > Math.PI) { polar[i].a -= 2 * Math.PI; d -= 2 * Math.PI; }
    while (d < -Math.PI) { polar[i].a += 2 * Math.PI; d += 2 * Math.PI; }
  }

  const startX = stage[0] / 2 - C[0];              // ring centred horizontally
  const finalX = cfg.finalRight - logoSize[0];      // logo pushed right
  const logoY = (stage[1] - logoSize[1]) / 2;       // logo centred vertically
  const ringY = stage[1] / 2 - C[1];                // ring centred vertically

  /** Points of the stroke for a curl amount (0 = logo, 1 = ring), in logo px. */
  function points(curl) {
    const out = new Array(N);
    for (let i = 0; i < N; i++) {
      const q = polar[i];
      const e = easeInOutCubic((curl - q.s * stagger) / (1 - stagger));
      const r = lerp(q.r, R, e);
      const a = q.a + twist * ((q.r - R) / R) * e;
      out[i] = [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)];
    }
    return out;
  }

  /** SVG path data (Catmull-Rom smoothed into cubic Béziers). */
  function toPath(P, precision = 1) {
    const f = (n) => n.toFixed(precision);
    let d = `M${f(P[0][0])} ${f(P[0][1])}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d;
  }

  /**
   * Everything needed to draw time t (ms, clamped to [0, duration]).
   * Draw order: translate(translateX, translateY) → rotate(rotation, center) → stroke `path`.
   */
  function frame(t) {
    t = Math.max(0, Math.min(duration, t));
    let phase = "hold";
    for (const p of phases) if (tl[p] > 0 && t >= starts[p]) phase = p;
    const local = (p) => (tl[p] > 0 ? clamp01((t - starts[p]) / tl[p]) : 1);

    let curl = 0, spin = 0, slide = 0, lift = 0;
    if (phase === "curl") { curl = local("curl"); lift = easeInOutCubic(curl); }
    else if (phase === "spin") { curl = 1; lift = 1; spin = easeInOutCubic(local("spin")); }
    else if (phase === "unroll") { const u = local("unroll"); curl = 1 - u; lift = 1 - easeInOutCubic(u); slide = easeInOutCubic(u); }
    else if (phase === "rest") { slide = 1; }

    const pts = points(curl);
    return {
      phase,
      curl,
      path: toPath(pts),
      points: pts,
      rotation: spin * 360 * cfg.spins,             // degrees, clockwise, around cfg.center
      translateX: lerp(startX, finalX, slide),
      translateY: lerp(logoY, ringY, lift),
      textOpacity: clamp01((slide - 0.55) / 0.45),
    };
  }

  return { config: cfg, duration, playDuration, starts, frame, points, toPath };
}

/* ------------------------------------------------------------------ */
/* <rocus-swirl> custom element                                        */
/* ------------------------------------------------------------------ */
/*
  Attributes
    autoplay            start on mount
    loop                repeat forever (includes the rest phase between loops)
    speed="1"           playback rate
    hold="600"          ms before curling starts (and other timeline keys: curl, spin, unroll, rest)
    color="#4A90E2"     stroke colour (also settable via CSS: --rocus-color)
    label="Rocus"       accessible name
  Methods
    play(), pause(), restart(), seek(ms)
  Properties
    duration, playDuration, currentTime, playing
  Events (bubble, composed)
    rocus-phase     detail: { phase }         phase changes
    rocus-reveal    detail: {}                logo starts sliding right, time to animate your text in
    rocus-complete  detail: {}                one-shot finished (not fired while looping)
  Slot
    default slot → text area on the left, fades in during the slide.
    Style it from outside; ::part(text) and ::part(svg) are exposed.
  Reduced motion
    With prefers-reduced-motion: reduce, it jumps to the final logo and fires rocus-complete.
*/
function defineElement() {
  if (typeof window === "undefined" || typeof customElements === "undefined") return;
  if (customElements.get("rocus-swirl")) return;

  const TIMELINE_KEYS = ["hold", "curl", "spin", "unroll", "rest"];

  class RocusSwirlElement extends HTMLElement {
    static get observedAttributes() { return ["color", "label", ...TIMELINE_KEYS]; }

    constructor() {
      super();
      this._t = 0; this._playing = false; this._last = null; this._raf = 0; this._phase = null; this._revealed = false;
      const root = this.attachShadow({ mode: "open" });
      const [sw, sh] = ROCUS_DEFAULTS.stage;
      const [tx, ty, tw, th] = ROCUS_DEFAULTS.textArea;
      root.innerHTML = `
        <style>
          :host { display: block; position: relative; aspect-ratio: ${sw} / ${sh}; }
          svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
          .text { position: absolute; left: ${(tx / sw) * 100}%; top: ${(ty / sh) * 100}%;
                  width: ${(tw / sw) * 100}%; height: ${(th / sh) * 100}%;
                  display: flex; align-items: center; justify-content: flex-end; opacity: 0; }
        </style>
        <svg part="svg" viewBox="0 0 ${sw} ${sh}" role="img">
          <g class="mover"><g class="spinner"><path fill="none" stroke-linecap="butt" stroke-linejoin="round"></path></g></g>
        </svg>
        <div class="text" part="text"><slot></slot></div>`;
      this._svg = root.querySelector("svg");
      this._mover = root.querySelector(".mover");
      this._spinner = root.querySelector(".spinner");
      this._path = root.querySelector("path");
      this._text = root.querySelector(".text");
      this._tick = this._tick.bind(this);
      this._build();
    }

    connectedCallback() {
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) { this.seek(this._anim.playDuration); this._emit("rocus-complete"); return; }
      this._render();
      if (this.hasAttribute("autoplay")) this.play();
    }
    disconnectedCallback() { cancelAnimationFrame(this._raf); this._raf = 0; this._playing = false; }
    attributeChangedCallback() { if (this._anim) { this._build(); this._render(); } }

    _build() {
      const timeline = {};
      for (const k of TIMELINE_KEYS) { const v = this.getAttribute(k); if (v !== null && !isNaN(+v)) timeline[k] = +v; }
      this._anim = createRocusSwirl({ timeline });
      const c = this._anim.config;
      this._path.setAttribute("stroke-width", c.strokeWidth);
      this._path.style.stroke = this.getAttribute("color") || `var(--rocus-color, ${c.color})`;
      this._svg.setAttribute("aria-label", this.getAttribute("label") || "Rocus logo");
    }

    get duration() { return this._anim.duration; }
    get playDuration() { return this._anim.playDuration; }
    get currentTime() { return this._t; }
    get playing() { return this._playing; }

    play() {
      if (this._t >= this._anim.playDuration && !this.hasAttribute("loop")) this._t = 0, this._revealed = false;
      if (this._playing) return;
      this._playing = true; this._last = null;
      this._raf = requestAnimationFrame(this._tick);
    }
    pause() { this._playing = false; cancelAnimationFrame(this._raf); this._raf = 0; }
    restart() { this._t = 0; this._revealed = false; this._phase = null; this._render(); this.play(); }
    seek(ms) { this._t = Math.max(0, Math.min(this._anim.duration, +ms || 0)); this._render(); }

    _tick(now) {
      if (!this._playing) return;
      if (this._last !== null) this._t += (now - this._last) * (parseFloat(this.getAttribute("speed")) || 1);
      this._last = now;
      const loop = this.hasAttribute("loop");
      if (loop && this._t >= this._anim.duration) { this._t %= this._anim.duration; this._revealed = false; }
      if (!loop && this._t >= this._anim.playDuration) {
        this._t = this._anim.playDuration; this._render();
        this._playing = false; this._raf = 0; this._emit("rocus-complete"); return;
      }
      this._render();
      this._raf = requestAnimationFrame(this._tick);
    }

    _render() {
      const f = this._anim.frame(this._t);
      const [cx, cy] = this._anim.config.center;
      this._path.setAttribute("d", f.path);
      this._spinner.setAttribute("transform", `rotate(${f.rotation.toFixed(2)} ${cx} ${cy})`);
      this._mover.setAttribute("transform", `translate(${f.translateX.toFixed(1)} ${f.translateY.toFixed(1)})`);
      this._text.style.opacity = f.textOpacity;
      if (f.phase !== this._phase) { this._phase = f.phase; this._emit("rocus-phase", { phase: f.phase }); }
      if (!this._revealed && (f.phase === "unroll" || f.phase === "rest")) { this._revealed = true; this._emit("rocus-reveal"); }
    }

    _emit(type, detail = {}) { this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })); }
  }

  customElements.define("rocus-swirl", RocusSwirlElement);
}
defineElement();
