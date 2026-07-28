<script lang="ts">
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const gl = canvas.getContext('webgl')!;
    if (!gl) return;

    const VS = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const FS = `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_resolution;

      void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);

        // Adjusted to match ReactBits speed=0.2 and warpStrength=1
        float warp = sin(uv.x * 1.2 + u_time * 0.2) * 0.5
                   + cos(uv.y * 0.9 - u_time * 0.15) * 0.4;
        float warp2 = cos(uv.x * 0.6 - u_time * 0.1) * 0.3;

        vec2 warped = vec2(uv.x + warp * 0.3, uv.y + warp2 * 0.3);

        // Smooth flowing bands
        float band1 = sin(warped.y * 3.5 + warp * 2.5 + u_time * 0.3) * 0.5 + 0.5;
        float band2 = sin(warped.x * 2.5 - warp2 * 2.0 + u_time * 0.2) * 0.5 + 0.5;
        float combined = (band1 + band2) * 0.5;

        // Base color matching ReactBits: #810eee (rgb: 129, 14, 238 -> 0.506, 0.055, 0.933)
        vec3 baseColor = vec3(0.0, 0.0, 0.0);
        vec3 targetColor = vec3(0.506, 0.055, 0.933);
        
        // Intensify the color mixing to match the requested aesthetic
        vec3 col = mix(baseColor, targetColor, pow(combined, 1.2) * 1.5);

        // Vignette to keep the edges dark and blended
        float dist = length(uv * 0.55);
        float vig = smoothstep(1.8, 0.0, dist);
        col = col * vig;

        gl_FragColor = vec4(col, vig * 0.95);
      }
    `;

    function compile(type: number, src: string) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let animId: number;
    let startTime = Date.now();
    let lastRenderTime = 0;
    const targetFps = 35;
    const frameInterval = 1000 / targetFps;

    function resize() {
      // Downsample WebGL render buffer scale for 4x GPU performance boost
      // Ambient fluid shaders look even smoother when sampled at half-res
      const scale = 0.5;
      canvas.width = Math.max(320, Math.floor(window.innerWidth * scale));
      canvas.height = Math.max(240, Math.floor(window.innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function render(now: number) {
      animId = requestAnimationFrame(render);

      const delta = now - lastRenderTime;
      if (delta < frameInterval) return;
      lastRenderTime = now - (delta % frameInterval);

      const t = (Date.now() - startTime) / 1000;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    resize();
    render(performance.now());
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  });
</script>

<canvas
  bind:this={canvas}
  aria-hidden="true"
  style="
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
  "
></canvas>
