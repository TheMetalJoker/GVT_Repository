(() => {
  "use strict";


  const SETTINGS = Object.freeze({
    torus: { majorRadius: 0.88, minorRadius: 0.34, segmentsU: 48, segmentsV: 28, center: [-1.35, 0, 0] },
    sphereCenter: [1.28, 0, 0],
    figureEight: { segmentsU: 120, segmentsV: 32, scale: 0.95, tubeRadius: 0.22, center: [0, -1.85, 0] },
    camera: { angle: 0.30, radius: 8.2, height: 2.3, target: [0, 0, 0] },
    maxDepth: 5
  });
  const TAU = 2 * Math.PI;
  const vertexShader = `#version 300 es
    in vec3 aPosition;
    in vec3 aNormal;
    in vec3 aColor;
    uniform mat4 uMvp;
    out vec3 vNormal;
    out vec3 vColor;
    void main() {
      gl_Position = uMvp * vec4(aPosition, 1.0);
      vNormal = aNormal;
      vColor = aColor;
    }
  `;
  const fragmentShader = `#version 300 es
    precision highp float;
    in vec3 vNormal;
    in vec3 vColor;
    uniform float uWire;
    out vec4 outColor;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 light = normalize(vec3(-0.45, 0.82, 0.72));
      float diffuse = max(dot(n, light), 0.0);
      float shade = 0.36 + 0.64 * diffuse;
      vec3 base = vColor * shade;
      vec3 lineColor = vec3(0.035, 0.085, 0.088);
      outColor = vec4(mix(base, lineColor, uWire), 1.0);
    }
  `;

  function makeCollector() {
    return { positions: [], normals: [], colors: [], triangles: [], lines: [], edgeSet: new Set() };
  }
  function pushVertex(mesh, point, normal, color) {
    const index = mesh.positions.length / 3;
    mesh.positions.push(...point);
    mesh.normals.push(...normal);
    mesh.colors.push(...color);
    return index;
  }
  function addEdge(mesh, a, b) {
    const low = Math.min(a, b), high = Math.max(a, b), key = `${low}:${high}`;
    if (!mesh.edgeSet.has(key)) { mesh.edgeSet.add(key); mesh.lines.push(low, high); }
  }
  function addTriangle(mesh, pa, pb, pc, colorFn) {
    const na = normalize(pa), nb = normalize(pb), nc = normalize(pc);
    const a = pushVertex(mesh, pa, na, colorFn(na));
    const b = pushVertex(mesh, pb, nb, colorFn(nb));
    const c = pushVertex(mesh, pc, nc, colorFn(nc));
    mesh.triangles.push(a, b, c);
    addEdge(mesh, a, b); addEdge(mesh, b, c); addEdge(mesh, c, a);
  }
  function normalize(v) {
    const length = Math.hypot(v[0], v[1], v[2]);
    if (!length) throw new Error("Ein Nullvektor kann nicht normiert werden.");
    return [v[0] / length, v[1] / length, v[2] / length];
  }
  function normalColor(n, warm = false) {

    const mapped = n.map(component => 0.5 + 0.5 * component);
    if (!warm) return mapped;
    return [0.48 + mapped[0] * 0.43, 0.22 + mapped[1] * 0.48, 0.14 + mapped[2] * 0.38];
  }
  function buildTorus({ majorRadius: R, minorRadius: r, segmentsU: nu, segmentsV: nv }) {
    const mesh = makeCollector();
    const index = (i, j) => i * nv + j;
    for (let i = 0; i < nu; i++) {
      const u = TAU * i / nu;
      for (let j = 0; j < nv; j++) {
        const v = TAU * j / nv;
        const p = [(R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)];
        const n = [Math.cos(u) * Math.cos(v), Math.sin(u) * Math.cos(v), Math.sin(v)];
        pushVertex(mesh, p, n, normalColor(n, true));
      }
    }
    // Each wraparound quad is split into two triangles; periodic indices close both seams.
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = index(i, j), b = index((i + 1) % nu, j);
      const c = index(i, (j + 1) % nv), d = index((i + 1) % nu, (j + 1) % nv);
      mesh.triangles.push(a, b, c, b, d, c);
      addEdge(mesh, a, b); addEdge(mesh, a, c);
    }
    return packMesh(mesh);
  }

  function buildFigureEight({ segmentsU: nu, segmentsV: nv, scale, tubeRadius }) {
  const mesh = makeCollector();
  const index = (i, j) => i * nv + j;

  for (let i = 0; i < nu; i++) {
    const u = TAU * i / nu;
    const cx = Math.sin(u), cy = Math.sin(u) * Math.cos(u);
    const tx = Math.cos(u), ty = Math.cos(2 * u);
    const tangentLength = Math.hypot(tx, ty);
    const nx = -ty / tangentLength, ny = tx / tangentLength;

    for (let j = 0; j < nv; j++) {
      const v = TAU * j / nv;
      const radial = Math.cos(v), vertical = Math.sin(v);

      const p = [
        scale * (cx + tubeRadius * radial * nx),
        scale * (cy + tubeRadius * radial * ny),
        scale * tubeRadius * vertical
      ];

      const n = normalize([radial * nx, radial * ny, vertical]);

      const t = Math.max(0, Math.min(
        1,
        (p[0] / scale + 1 + tubeRadius) / (2 * (1 + tubeRadius))
      ));

      const color = [
        0.10 * (1 - t) + 0.95 * t, // Rot
        0.25 * (1 - t) + 0.45 * t, // Grün
        0.85 * (1 - t) + 0.10 * t  // Blau
      ];

      pushVertex(mesh, p, n, color);
    }
  }

  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = index(i, j), b = index((i + 1) % nu, j);
      const c = index(i, (j + 1) % nv), d = index((i + 1) % nu, (j + 1) % nv);

      mesh.triangles.push(a, b, c, b, d, c);
      addEdge(mesh, a, b);
      addEdge(mesh, a, c);
    }
  }

  return packMesh(mesh);
}
  function packMesh(mesh) {
    return {
      positions: new Float32Array(mesh.positions), normals: new Float32Array(mesh.normals), colors: new Float32Array(mesh.colors),
      triangles: new Uint16Array(mesh.triangles), lines: new Uint16Array(mesh.lines)
    };
  }


  function buildRecursiveSphere(depth) {
    const mesh = makeCollector();
    const X = [1, 0, 0], NX = [-1, 0, 0], Y = [0, 1, 0], NY = [0, -1, 0], Z = [0, 0, 1], NZ = [0, 0, -1];
    const faces = [[X,Y,Z], [Y,NX,Z], [NX,NY,Z], [NY,X,Z], [Y,X,NZ], [NX,Y,NZ], [NY,NX,NZ], [X,NY,NZ]];
    function subdivide(a, b, c, level) {
      if (level === 0) { addTriangle(mesh, a, b, c, normalColor); return; }
      const ab = normalize(a.map((v, i) => v + b[i]));
      const bc = normalize(b.map((v, i) => v + c[i]));
      const ca = normalize(c.map((v, i) => v + a[i]));
      subdivide(a, ab, ca, level - 1);
      subdivide(ab, b, bc, level - 1);
      subdivide(ca, bc, c, level - 1);
      subdivide(ab, bc, ca, level - 1);
    }
    faces.forEach(face => subdivide(face[0], face[1], face[2], depth));
    return packMesh(mesh);
  }

  function multiply4(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
      out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
    }
    return out;
  }
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect,0,0,0, 0,f,0,0, 0,0,(far + near) * nf,-1, 0,0,2 * far * near * nf,0]);
  }
  function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
  function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function lookAt(eye, center, preferredUp = [0, 1, 0]) {
    // Camera basis and inverse camera transform; if view is nearly vertical, choose a safe up.
    const forward = normalize(subtract(center, eye));
    let up = preferredUp;
    if (Math.abs(dot(forward, normalize(up))) > 0.995) up = [0, 0, 1];
    const side = normalize(cross(forward, up));
    const cameraUp = cross(side, forward);
    return new Float32Array([
      side[0], cameraUp[0], -forward[0], 0,
      side[1], cameraUp[1], -forward[1], 0,
      side[2], cameraUp[2], -forward[2], 0,
      -dot(side, eye), -dot(cameraUp, eye), dot(forward, eye), 1
    ]);
  }

  function compileShader(gl, type, source, label) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error(`${label}: Shader konnte nicht angelegt werden.`);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || "unbekannter Shaderfehler";
      gl.deleteShader(shader); throw new Error(`${label}: ${message}`);
    }
    return shader;
  }
  function createProgram(gl) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShader, "Vertex-Shader");
    let fs, program;
    try {
      fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader, "Fragment-Shader");
      program = gl.createProgram();
      if (!program) throw new Error("WebGL-Programm konnte nicht angelegt werden.");
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Shader-Link fehlgeschlagen.");
      return program;
    } catch (error) { if (program) gl.deleteProgram(program); throw error; }
    finally { gl.deleteShader(vs); if (fs) gl.deleteShader(fs); }
  }
  function createGpuMesh(gl, program, data) {
    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Vertex-Array konnte nicht angelegt werden.");
    gl.bindVertexArray(vao);
    const attributeBuffers = [];
    for (const [name, values] of [["aPosition", data.positions], ["aNormal", data.normals], ["aColor", data.colors]]) {
      const location = gl.getAttribLocation(program, name), buffer = gl.createBuffer();
      if (location < 0 || !buffer) throw new Error(`Vertex-Attribut ${name} fehlt.`);
      attributeBuffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
    }
    const triangleBuffer = gl.createBuffer(), lineBuffer = gl.createBuffer();
    if (!triangleBuffer || !lineBuffer) throw new Error("Indexpuffer konnte nicht angelegt werden.");
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.triangles, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.lines, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, triangleBuffer, lineBuffer, attributeBuffers, triangleCount: data.triangles.length, lineCount: data.lines.length };
  }

  function init() {
    const canvas = document.getElementById("scene");
    const status = document.getElementById("status");
    const showError = error => { console.error("WebGL-Lernbasis:", error); status.textContent = `Darstellung nicht verfügbar: ${error.message || error}`; status.classList.add("visible"); };
    try {
      const gl = canvas.getContext("webgl2", { alpha: false, antialias: true, depth: true });
      if (!gl) throw new Error("WebGL 2 ist nicht verfügbar. Bitte einen WebGL-fähigen Browser verwenden.");
      const program = createProgram(gl);
      const mvpLocation = gl.getUniformLocation(program, "uMvp"), wireLocation = gl.getUniformLocation(program, "uWire");
      if (mvpLocation === null || wireLocation === null) throw new Error("Shader-Uniform konnte nicht gefunden werden.");
      const torus = createGpuMesh(gl, program, buildTorus(SETTINGS.torus));
      const figureEight = createGpuMesh(gl, program, buildFigureEight(SETTINGS.figureEight));
      let sphere;
      const camera = { ...SETTINGS.camera, target: SETTINGS.camera.target.slice() };
      const depthInput = document.getElementById("depth"), depthOutput = document.getElementById("depth-value");
      const triangleCount = document.getElementById("triangle-count"), wireInput = document.getElementById("wireframe");

      function updateSphere() {
        const depth = Number(depthInput.value), data = buildRecursiveSphere(depth);
        if (sphere) {
          gl.deleteVertexArray(sphere.vao);
          [...sphere.attributeBuffers, sphere.triangleBuffer, sphere.lineBuffer].forEach(buffer => gl.deleteBuffer(buffer));
        }
        sphere = createGpuMesh(gl, program, data);
        depthOutput.value = String(depth); depthOutput.textContent = String(depth);
        triangleCount.textContent = String(8 * (4 ** depth));
        draw();
      }
      function updateReadout() {
        document.getElementById("radius-value").textContent = camera.radius.toFixed(2);
        document.getElementById("height-value").textContent = camera.height.toFixed(2);
      }
      function draw() {
        if (!sphere) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        gl.viewport(0, 0, width, height); gl.clearColor(0.075, 0.13, 0.145, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
        const eye = [camera.target[0] + camera.radius * Math.sin(camera.angle), camera.target[1] + camera.height, camera.target[2] + camera.radius * Math.cos(camera.angle)];
        const view = lookAt(eye, camera.target, [0, 1, 0]);
        const projection = perspective(Math.PI / 4.2, width / height, 0.1, 60);
        const showWire = wireInput.checked;
        gl.useProgram(program);
        function renderObject(mesh, center) {
          const model = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, center[0],center[1],center[2],1]);
          const mvp = multiply4(projection, multiply4(view, model));
          gl.uniformMatrix4fv(mvpLocation, false, mvp);
          gl.bindVertexArray(mesh.vao);
          gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.triangleBuffer); gl.uniform1f(wireLocation, 0);
          gl.drawElements(gl.TRIANGLES, mesh.triangleCount, gl.UNSIGNED_SHORT, 0);
          gl.disable(gl.POLYGON_OFFSET_FILL);
          if (showWire) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.lineBuffer);
            gl.uniform1f(wireLocation, 1); gl.drawElements(gl.LINES, mesh.lineCount, gl.UNSIGNED_SHORT, 0);
          }
        }
        renderObject(torus, SETTINGS.torus.center);
        renderObject(sphere, SETTINGS.sphereCenter);
        renderObject(figureEight, SETTINGS.figureEight.center);
        gl.bindVertexArray(null);
      }
      depthInput.addEventListener("input", updateSphere);
      wireInput.addEventListener("change", draw);
      document.getElementById("reset-camera").addEventListener("click", () => {
        camera.angle = SETTINGS.camera.angle; camera.radius = SETTINGS.camera.radius; camera.height = SETTINGS.camera.height;
        updateReadout(); draw();
      });
      window.addEventListener("keydown", event => {
        // Controls behalten ihre native Tastaturbedienung (z. B. Range mit Pfeilen).
        if (event.target && event.target.matches && event.target.matches("input, button, select, textarea")) return;
        const key = event.key.toLowerCase();
        if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) event.preventDefault();
        const step = 0.22;
        if (key === "arrowleft") camera.angle -= 0.12;
        else if (key === "arrowright") camera.angle += 0.12;
        else if (key === "arrowup") camera.height = Math.min(5.5, camera.height + step);
        else if (key === "arrowdown") camera.height = Math.max(-5.5, camera.height - step);
        else if (key === "n") camera.radius = Math.max(4.2, Math.min(15, camera.radius + (event.shiftKey ? -0.35 : 0.35)));
        else return;
        updateReadout(); draw();
      });
      window.addEventListener("resize", draw, { passive: true });
      canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); showError(new Error("WebGL-Kontext verloren. Seite neu laden.")); });
      updateReadout(); updateSphere();
    } catch (error) { showError(error); }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
  }
})();
