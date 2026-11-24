(() => {
  "use strict";

  const SETTINGS = {
    torusMajorRadius: 1.02,
    torusMinorRadius: 0.30,
    loopRadius: 1.25,
    ballRadius: 0.075,
    speed: 0.68,
    camera: [3.65, 3.45, 5.15],
    target: [0, 0, 0],
    floorY: -1.55
  };

  const BALL_COLORS = [
    [0.96, 0.49, 0.29],
    [0.35, 0.78, 0.72],
    [0.96, 0.76, 0.36],
    [0.53, 0.65, 0.96]
  ];

  const DIRECTIONS = [
    0,
    Math.PI / 2,
    Math.PI,
    (3 * Math.PI) / 2
  ];

  const START_OFFSETS = [
    0,
    Math.PI / 2,
    Math.PI,
    (3 * Math.PI) / 2
  ];

  const vertexShaderSource = `#version 300 es
    in vec3 aPosition;
    in vec3 aNormal;
    in vec3 aColor;

    uniform mat4 uMvp;
    uniform mat4 uModel;

    out vec3 vNormal;
    out vec3 vColor;

    void main() {
      gl_Position = uMvp * vec4(aPosition, 1.0);
      vNormal = mat3(uModel) * aNormal;
      vColor = aColor;
    }
  `;

  const fragmentShaderSource = `#version 300 es
    precision highp float;

    in vec3 vNormal;
    in vec3 vColor;
    out vec4 outColor;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 lightDirection = normalize(vec3(-0.45, 0.82, 0.72));
      float diffuse = max(dot(normal, lightDirection), 0.0);
      float lighting = 0.38 + 0.62 * diffuse;

      outColor = vec4(vColor * lighting, 1.0);
    }
  `;

  function init() {
    const canvas = document.getElementById("scene");

    if (!canvas) {
      console.error('Kein Canvas mit id="scene" gefunden.');
      return;
    }

    const gl = canvas.getContext("webgl2");

    if (!gl) {
      showError(canvas, "WebGL 2 wird von diesem Browser nicht unterstützt.");
      return;
    }

    try {
      const program = createProgram(
        gl,
        vertexShaderSource,
        fragmentShaderSource
      );

      gl.useProgram(program);

      // Diese Werte liegen im gemeinsamen Gültigkeitsbereich
      // von init() und createMesh().
      const locations = {
        position: gl.getAttribLocation(program, "aPosition"),
        normal: gl.getAttribLocation(program, "aNormal"),
        color: gl.getAttribLocation(program, "aColor"),
        mvp: gl.getUniformLocation(program, "uMvp"),
        model: gl.getUniformLocation(program, "uModel")
      };

      const torus = createTorus(
        SETTINGS.torusMajorRadius,
        SETTINGS.torusMinorRadius,
        [0.24, 0.45, 0.80]
      );

      const tracks = createTracks();

      const balls = BALL_COLORS.map((color) =>
        createSphere(SETTINGS.ballRadius, color)
      );

      const ground = createGround();

      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0.055, 0.065, 0.085, 1.0);

      const toggleButton = document.getElementById("toggle-animation");
      const motionState = document.getElementById("motion-state");

      let isRunning = true;
      let elapsedTime = 0;
      let lastTimestamp = null;

      function setRunning(value) {
        isRunning = value;
        lastTimestamp = null;

        if (toggleButton) {
          toggleButton.setAttribute("aria-pressed", String(isRunning));
          toggleButton.innerHTML = isRunning
            ? 'Animation pausieren <span>Ⅱ</span>'
            : 'Animation fortsetzen <span>▶</span>';
        }

        if (motionState) {
          motionState.textContent = isRunning ? "LÄUFT" : "PAUSIERT";
        }
      }

      if (toggleButton) {
        toggleButton.addEventListener("click", () => {
          setRunning(!isRunning);
        });
      }

      window.addEventListener("keydown", (event) => {
        const target = event.target;
        const isTyping =
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

        if (isTyping || event.key.toLowerCase() !== "k" || event.repeat) {
          return;
        }

        setRunning(!isRunning);
      });

      function resizeCanvas() {
        const pixelRatio = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
        const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        gl.viewport(0, 0, width, height);
      }

      function draw(timestamp) {
        resizeCanvas();

        if (lastTimestamp !== null && isRunning) {
          elapsedTime += (timestamp - lastTimestamp) * 0.001;
        }
        lastTimestamp = timestamp;

        const aspect = canvas.width / canvas.height;
        const projection = perspectiveMatrix(Math.PI / 4, aspect, 0.1, 100);
        const view = lookAt(SETTINGS.camera, SETTINGS.target, [0, 1, 0]);
        const viewProjection = multiplyMatrices(projection, view);

        const spin = rotationYMatrix(elapsedTime * 0.12);
        const tiltX = rotationXMatrix(
          0.24 * Math.sin(elapsedTime * 0.75)
        );
        const tiltZ = rotationZMatrix(
          0.18 * Math.sin(elapsedTime * 0.95 + 0.8)
        );

        const sceneRotation = multiplyMatrices(
          spin,
          multiplyMatrices(tiltZ, tiltX)
        );

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);

        function render(mesh, modelMatrix) {
          const mvp = multiplyMatrices(viewProjection, modelMatrix);

          gl.uniformMatrix4fv(locations.mvp, false, mvp);
          gl.uniformMatrix4fv(locations.model, false, modelMatrix);
          gl.bindVertexArray(mesh.vao);
          gl.drawElements(mesh.mode, mesh.count, gl.UNSIGNED_SHORT, 0);
        }

        render(ground, identityMatrix());
        render(torus, sceneRotation);
        render(tracks, sceneRotation);

        balls.forEach((ball, index) => {
          const angle =
            elapsedTime * SETTINGS.speed + START_OFFSETS[index];
          const point = getLoopPoint(angle, DIRECTIONS[index]);
          const position = translationMatrix(point[0], point[1], point[2]);
          const model = multiplyMatrices(sceneRotation, position);

          render(ball, model);
        });

        gl.bindVertexArray(null);
        requestAnimationFrame(draw);
      }

      requestAnimationFrame(draw);

      // Erstellt und konfiguriert ein WebGL-Mesh.
      function createMesh(positions, normals, colors, indices, mode) {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        addAttributeBuffer(
          locations.position,
          positions,
          3
        );
        addAttributeBuffer(
          locations.normal,
          normals,
          3
        );
        addAttributeBuffer(
          locations.color,
          colors,
          3
        );

        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(
          gl.ELEMENT_ARRAY_BUFFER,
          new Uint16Array(indices),
          gl.STATIC_DRAW
        );

        gl.bindVertexArray(null);

        return { vao, count: indices.length, mode };
      }

      function addAttributeBuffer(location, data, size) {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(data),
          gl.STATIC_DRAW
        );
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
      }

      function createTorus(majorRadius, minorRadius, color) {
        const positions = [];
        const normals = [];
        const colors = [];
        const indices = [];
        const majorSegments = 64;
        const minorSegments = 24;

        for (let i = 0; i <= majorSegments; i++) {
          const u = (i / majorSegments) * Math.PI * 2;

          for (let j = 0; j <= minorSegments; j++) {
            const v = (j / minorSegments) * Math.PI * 2;
            const cosU = Math.cos(u);
            const sinU = Math.sin(u);
            const cosV = Math.cos(v);
            const sinV = Math.sin(v);
            const ringRadius = majorRadius + minorRadius * cosV;

            positions.push(
              ringRadius * cosU,
              minorRadius * sinV,
              ringRadius * sinU
            );
            normals.push(cosV * cosU, sinV, cosV * sinU);
            colors.push(...color);
          }
        }

        for (let i = 0; i < majorSegments; i++) {
          for (let j = 0; j < minorSegments; j++) {
            const a = i * (minorSegments + 1) + j;
            const b = a + minorSegments + 1;

            indices.push(a, b, a + 1, b, b + 1, a + 1);
          }
        }

        return createMesh(
          positions, normals, colors, indices, gl.TRIANGLES
        );
      }

      function createSphere(radius, color) {
        const positions = [];
        const normals = [];
        const colors = [];
        const indices = [];
        const latitudeSegments = 16;
        const longitudeSegments = 24;

        for (let lat = 0; lat <= latitudeSegments; lat++) {
          const theta = (lat / latitudeSegments) * Math.PI;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);

          for (let lon = 0; lon <= longitudeSegments; lon++) {
            const phi = (lon / longitudeSegments) * Math.PI * 2;
            const x = sinTheta * Math.cos(phi);
            const y = cosTheta;
            const z = sinTheta * Math.sin(phi);

            positions.push(radius * x, radius * y, radius * z);
            normals.push(x, y, z);
            colors.push(...color);
          }
        }

        for (let lat = 0; lat < latitudeSegments; lat++) {
          for (let lon = 0; lon < longitudeSegments; lon++) {
            const first = lat * (longitudeSegments + 1) + lon;
            const second = first + longitudeSegments + 1;

            indices.push(
              first, second, first + 1,
              second, second + 1, first + 1
            );
          }
        }

        return createMesh(
          positions, normals, colors, indices, gl.TRIANGLES
        );
      }

      function createTracks() {
        const positions = [];
        const normals = [];
        const colors = [];
        const indices = [];
        const segments = 160;
        const color = [0.64, 0.70, 0.82];

        DIRECTIONS.forEach((direction) => {
          const startIndex = positions.length / 3;

          for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            positions.push(...getLoopPoint(angle, direction));
            normals.push(0, 1, 0);
            colors.push(...color);
          }

          for (let i = 0; i < segments; i++) {
            indices.push(
              startIndex + i,
              startIndex + ((i + 1) % segments)
            );
          }
        });

        return createMesh(positions, normals, colors, indices, gl.LINES);
      }

      function createGround() {
        const positions = [];
        const normals = [];
        const colors = [];
        const indices = [];
        const size = 8;
        const step = 0.5;
        const color = [0.20, 0.24, 0.31];

        // Zeichnet ein Liniengitter auf der XZ-Ebene.
        for (let value = -size; value <= size; value += step) {
          addLine([-size, SETTINGS.floorY, value], [size, SETTINGS.floorY, value]);
          addLine([value, SETTINGS.floorY, -size], [value, SETTINGS.floorY, size]);
        }

        function addLine(a, b) {
          const start = positions.length / 3;
          positions.push(...a, ...b);
          normals.push(0, 1, 0, 0, 1, 0);
          colors.push(...color, ...color);
          indices.push(start, start + 1);
        }

        return createMesh(positions, normals, colors, indices, gl.LINES);
      }
    } catch (error) {
      console.error(error);
      showError(canvas, `Fehler beim Starten der Szene: ${error.message}`);
    }
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader-Fehler: ${message}`);
    }

    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Programm-Link-Fehler: ${message}`);
    }

    return program;
  }

function getLoopPoint(angle, direction) {
  const radius = SETTINGS.loopRadius;

  // Die Kreisbahn verläuft durch den Ursprung (Mittelpunkt des Torus).
  // Ihr äußerster Punkt liegt zwei Bahnradii vom Mittelpunkt entfernt.
  const distanceFromCenter = radius * (1 - Math.cos(angle));
  const y = radius * Math.sin(angle);

  return [
    distanceFromCenter * Math.cos(direction),
    y,
    distanceFromCenter * Math.sin(direction)
  ];
}

  function identityMatrix() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  function translationMatrix(x, y, z) {
    const matrix = identityMatrix();
    matrix[12] = x;
    matrix[13] = y;
    matrix[14] = z;
    return matrix;
  }

  function rotationXMatrix(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1
    ]);
  }

  function rotationYMatrix(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1
    ]);
  }

  function rotationZMatrix(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  function multiplyMatrices(a, b) {
    const result = new Float32Array(16);

    for (let column = 0; column < 4; column++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;

        for (let k = 0; k < 4; k++) {
          sum += a[k * 4 + row] * b[column * 4 + k];
        }

        result[column * 4 + row] = sum;
      }
    }

    return result;
  }

  function perspectiveMatrix(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const range = 1 / (near - far);

    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * range, -1,
      0, 0, 2 * far * near * range, 0
    ]);
  }

  function lookAt(eye, target, up) {
    const zAxis = normalizeVector([
      eye[0] - target[0],
      eye[1] - target[1],
      eye[2] - target[2]
    ]);
    const xAxis = normalizeVector(crossProduct(up, zAxis));
    const yAxis = crossProduct(zAxis, xAxis);

    return new Float32Array([
      xAxis[0], yAxis[0], zAxis[0], 0,
      xAxis[1], yAxis[1], zAxis[1], 0,
      xAxis[2], yAxis[2], zAxis[2], 0,
      -dotProduct(xAxis, eye),
      -dotProduct(yAxis, eye),
      -dotProduct(zAxis, eye),
      1
    ]);
  }

  function normalizeVector(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]);

    if (length === 0) return [0, 0, 0];

    return [
      vector[0] / length,
      vector[1] / length,
      vector[2] / length
    ];
  }

  function crossProduct(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function dotProduct(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function showError(canvas, message) {
    console.error(message);

    const status = document.getElementById("status");
    if (status) {
      status.textContent = message;
    } else {
      const error = document.createElement("p");
      error.textContent = message;
      error.style.color = "red";
      canvas.insertAdjacentElement("afterend", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();