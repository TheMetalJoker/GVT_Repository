(() => {
  "use strict";

  const TAU = Math.PI * 2;

  // Flächenparameter und Parametrisierungen
  const SURFACES = {
    torus: {
      segmentsU: 80,
      segmentsV: 56,
      closedU: true,
      closedV: true,
      scale: 1,

      point(u, v) {
        const majorRadius = 0.62;
        const minorRadius = 0.22;

        return [
          (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u),
          (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u),
          minorRadius * Math.sin(v)
        ];
      },

      color: torusColor
    },

    dini: {
      segmentsU: 100,
      segmentsV: 60,
      closedU: false,
      closedV: false,
      scale: 2.0,

      point(u, v) {
        const a = 0.20;
        const b = 0.035;

        return [
          a * Math.cos(u) * Math.sin(v),
          a * Math.sin(u) * Math.sin(v),
          a * (Math.cos(v) + Math.log(Math.tan(v / 2))) + b * u
        ];
      },

      color: diniColor
    },

    figureEight: {
      segmentsU: 120,
      segmentsV: 32,
      closedU: true,
      closedV: true,
      scale: 1.0,

  point(u, v) {
    const a = 0.55; // Breite der Acht
    const b = 0.28; // Höhe der Acht
    const tubeRadius = 0.09;

    // Mittellinie: eine geschlossene Acht in der x-y-Ebene
    const x = a * Math.sin(u);
    const y = b * Math.sin(2 * u);

    // Tangente der Mittellinie
    const dx = a * Math.cos(u);
    const dy = 2 * b * Math.cos(2 * u);
    const length = Math.hypot(dx, dy);

    // Einheitsnormale in der x-y-Ebene
    const normalX = -dy / length;
    const normalY = dx / length;

    // Kreisquerschnitt des Rohrs
    const around = tubeRadius * Math.cos(v);
    const z = tubeRadius * Math.sin(v);

    return [
      x + normalX * around,
      y + normalY * around,
      z
    ];
  },

  color: figureEightColor
  }
  };

  const VERTEX_SHADER = `#version 300 es
    in vec3 aPosition;
    in vec3 aColor;

    uniform mat4 uMvp;

    out vec3 vColor;

    void main() {
      gl_Position = uMvp * vec4(aPosition, 1.0);
      vColor = aColor;
    }
  `;

  const FRAGMENT_SHADER = `#version 300 es
    precision highp float;

    in vec3 vColor;

    uniform float uWire;

    out vec4 outColor;

    void main() {
      vec3 gridColor = vec3(0.055, 0.12, 0.145);
      outColor = vec4(mix(vColor, gridColor, uWire), 1.0);
    }
  `;

  // Farbverlauf für den Torus.
  function torusColor(u, v) {
    const t = 0.5 + 0.5 * Math.sin(u + 0.65 * Math.cos(v));
    const colorA = [0.82, 0.34, 0.22];
    const colorB = [0.98, 0.70, 0.39];
    const shade = 0.78 + 0.22 * (0.5 + 0.5 * Math.cos(v - 0.45));

    return colorA.map((channel, i) =>
      (channel * (1 - t) + colorB[i] * t) * shade
    );
  }

  // Farbverlauf für die Dini-Fläche entlang des Parameters v.
  function diniColor(u, v) {
    const t = (v - 0.01) / (2 - 0.01);
    const colorA = [0.18, 0.68, 0.72];
    const colorB = [0.95, 0.69, 0.34];

    return colorA.map((channel, i) =>
      channel * (1 - t) + colorB[i] * t
    );
  }

  function figureEightColor(u, v) {
  const t = 0.5 + 0.5 * Math.sin(u);
  const colorA = [0.25, 0.65, 0.82];
  const colorB = [0.95, 0.55, 0.30];

  return colorA.map((channel, i) =>
    channel * (1 - t) + colorB[i] * t
  );
}

  // Multipliziert zwei 4x4-Matrizen im Spalten-major-Format von WebGL.
  function multiply4(a, b) {
    const result = new Float32Array(16);

    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        result[col * 4 + row] =
          a[row] * b[col * 4] +
          a[4 + row] * b[col * 4 + 1] +
          a[8 + row] * b[col * 4 + 2] +
          a[12 + row] * b[col * 4 + 3];
      }
    }

    return result;
  }

  // Feste Schrägansicht durch Rotation um x- und y-Achse.
  function rotationMatrix(xAngle, yAngle) {
    const cx = Math.cos(xAngle);
    const sx = Math.sin(xAngle);
    const cy = Math.cos(yAngle);
    const sy = Math.sin(yAngle);

    const rotationX = new Float32Array([
      1, 0, 0, 0,
      0, cx, sx, 0,
      0, -sx, cx, 0,
      0, 0, 0, 1
    ]);

    const rotationY = new Float32Array([
      cy, 0, -sy, 0,
      0, 1, 0, 0,
      sy, 0, cy, 0,
      0, 0, 0, 1
    ]);

    return multiply4(rotationX, rotationY);
  }

  // Orthografische Projektion mit Seitenverhältnis des Canvas.
  function orthographic(aspect) {
    const safeAspect = Math.max(aspect, 0.001);
    const halfWidth = Math.max(1, safeAspect);
    const halfHeight = Math.max(1, 1 / safeAspect);

    return new Float32Array([
      1 / halfWidth, 0, 0, 0,
      0, 1 / halfHeight, 0, 0,
      0, 0, -1, 0,
      0, 0, 0, 1
    ]);
  }

  // Erstellt Dreiecke und Gitterlinien für eine parametrisierte Fläche.
  function createMesh(surface, uMin, uMax, vMin, vMax) {
    const nu = surface.segmentsU;
    const nv = surface.segmentsV;

    const columns = surface.closedU ? nu : nu + 1;
    const rows = surface.closedV ? nv : nv + 1;
    const vertexCount = columns * rows;

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const triangles = [];
    const lines = [];

    function indexAt(i, j) {
      const wrappedI = surface.closedU ? i % columns : i;
      const wrappedJ = surface.closedV ? j % rows : j;
      return wrappedI * rows + wrappedJ;
    }

    // Eckpunkte der Fläche und zugehörige Farben berechnen.
    for (let i = 0; i < columns; i++) {
      const u = uMin + (uMax - uMin) * i / nu;

      for (let j = 0; j < rows; j++) {
        const v = vMin + (vMax - vMin) * j / nv;
        const index = indexAt(i, j);

        positions.set(surface.point(u, v), index * 3);
        colors.set(surface.color(u, v), index * 3);
      }
    }

    // Jede Zelle in zwei Dreiecke teilen und ihre Gitterlinien hinzufügen.
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a = indexAt(i, j);
        const b = indexAt(i + 1, j);
        const c = indexAt(i, j + 1);
        const d = indexAt(i + 1, j + 1);

        triangles.push(a, b, c, b, d, c);
        lines.push(a, b, a, c);
      }
    }

    const IndexArray =
      vertexCount <= 65536 ? Uint16Array : Uint32Array;

    return {
      positions,
      colors,
      triangles: new IndexArray(triangles),
      lines: new IndexArray(lines),
      indexType:
        vertexCount <= 65536 ? "UNSIGNED_SHORT" : "UNSIGNED_INT"
    };
  }

  function compileShader(gl, type, source, label) {
    const shader = gl.createShader(type);

    if (!shader) {
      throw new Error(`${label}-Shader konnte nicht erstellt werden.`);
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || "Keine Detailmeldung.";
      gl.deleteShader(shader);
      throw new Error(`${label}-Shaderfehler:\n${message}`);
    }

    return shader;
  }

  function createProgram(gl) {
    const vertexShader = compileShader(
      gl,
      gl.VERTEX_SHADER,
      VERTEX_SHADER,
      "Vertex"
    );

    let fragmentShader;
    let program;

    try {
      fragmentShader = compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        FRAGMENT_SHADER,
        "Fragment"
      );

      program = gl.createProgram();

      if (!program) {
        throw new Error("WebGL-Programm konnte nicht erstellt werden.");
      }

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message =
          gl.getProgramInfoLog(program) || "Keine Detailmeldung.";
        throw new Error(`Shaderprogramm konnte nicht verknüpft werden:\n${message}`);
      }

      return program;
    } catch (error) {
      if (program) {
        gl.deleteProgram(program);
      }
      throw error;
    } finally {
      gl.deleteShader(vertexShader);
      if (fragmentShader) {
        gl.deleteShader(fragmentShader);
      }
    }
  }

  function addAttribute(gl, program, name, data, size) {
    const location = gl.getAttribLocation(program, name);

    if (location < 0) {
      throw new Error(`Shader-Attribut "${name}" wurde nicht gefunden.`);
    }

    const buffer = gl.createBuffer();

    if (!buffer) {
      throw new Error(`Puffer für "${name}" konnte nicht erstellt werden.`);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);

    return buffer;
  }

  function createIndexBuffer(gl, data) {
    const buffer = gl.createBuffer();

    if (!buffer) {
      throw new Error("Indexpuffer konnte nicht erstellt werden.");
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);

    return buffer;
  }

  function setupRenderer(canvas, surface, uMin, uMax, vMin, vMax) {
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      alpha: false
    });

    if (!gl) {
      throw new Error("WebGL 2 ist in diesem Browser nicht verfügbar.");
    }

    const program = createProgram(gl);
    const mesh = createMesh(surface, uMin, uMax, vMin, vMax);
    const vao = gl.createVertexArray();

    if (!vao) {
      throw new Error("Vertex-Array-Objekt konnte nicht erstellt werden.");
    }

    gl.bindVertexArray(vao);

    addAttribute(gl, program, "aPosition", mesh.positions, 3);
    addAttribute(gl, program, "aColor", mesh.colors, 3);

    const triangleBuffer = createIndexBuffer(gl, mesh.triangles);
    const lineBuffer = createIndexBuffer(gl, mesh.lines);

    gl.bindVertexArray(null);

    const mvpLocation = gl.getUniformLocation(program, "uMvp");
    const wireLocation = gl.getUniformLocation(program, "uWire");
    const rotation = rotationMatrix(-0.48, 0.58);

    const indexType =
      mesh.indexType === "UNSIGNED_INT"
        ? gl.UNSIGNED_INT
        : gl.UNSIGNED_SHORT;

    // Gleichmäßige Skalierung der jeweiligen Fläche.
    const scale = surface.scale;
    const scaleMatrix = new Float32Array([
      scale, 0, 0, 0,
      0, scale, 0, 0,
      0, 0, scale, 0,
      0, 0, 0, 1
    ]);

    function draw() {
      const bounds = canvas.getBoundingClientRect();

      if (!bounds.width || !bounds.height) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.max(1, Math.round(bounds.width * dpr));
      const pixelHeight = Math.max(1, Math.round(bounds.height * dpr));

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      gl.viewport(0, 0, pixelWidth, pixelHeight);
      gl.clearColor(0.082, 0.165, 0.20, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);

      const modelMatrix = multiply4(rotation, scaleMatrix);
      const mvp = multiply4(
        orthographic(pixelWidth / pixelHeight),
        modelMatrix
      );

      gl.useProgram(program);
      gl.uniformMatrix4fv(mvpLocation, false, mvp);
      gl.bindVertexArray(vao);

      // Flächenfüllung zeichnen.
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 1);
      gl.uniform1f(wireLocation, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer);
      gl.drawElements(
        gl.TRIANGLES,
        mesh.triangles.length,
        indexType,
        0
      );

      // Gitterlinien über die Fläche zeichnen.
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.uniform1f(wireLocation, 1);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuffer);
      gl.drawElements(
        gl.LINES,
        mesh.lines.length,
        indexType,
        0
      );

      gl.bindVertexArray(null);
    }

    return draw;
  }

  function showError(canvas, error) {
    console.error("WebGL-Fehler:", error);

    const message = document.createElement("p");
    message.className = "error";
    message.textContent =
      error instanceof Error ? error.message : String(error);

    canvas.replaceWith(message);
  }

  function renderCanvas(id, surface, uMin, uMax, vMin, vMax) {
    const canvas = document.getElementById(id);

    if (!canvas) {
      console.warn(`Canvas mit der ID "${id}" wurde nicht gefunden.`);
      return;
    }

    try {
      const draw = setupRenderer(
        canvas,
        surface,
        uMin,
        uMax,
        vMin,
        vMax
      );

      draw();

      if ("ResizeObserver" in window) {
        const observer = new ResizeObserver(draw);
        observer.observe(canvas);
      } else {
        window.addEventListener("resize", draw, { passive: true });
      }
    } catch (error) {
      showError(canvas, error);
    }
  }

  function init() {
    // Torus: beide Parameter laufen von 0 bis 2π.
    renderCanvas(
      "torus",
      SURFACES.torus,
      0,
      TAU,
      0,
      TAU
    );

    // Dini-Fläche: u ∈ [0, 4π], v ∈ [0.01, 2].
    renderCanvas(
      "dini",
      SURFACES.dini,
      0,
      4 * Math.PI,
      0.01,
      2
    );

    renderCanvas(
      "figureEight",
      SURFACES.figureEight,
      0,
      TAU,
      0,
      TAU
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();