"use strict";
console.log("Neue farbige script.js wurde geladen");

// Canvas und WebGL-Kontext abrufen
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

if (!gl) {
  throw new Error("WebGL konnte in diesem Browser nicht gestartet werden.");
}

// Shader-Quelltexte aus der HTML-Datei lesen
const vertexSource =
  document.getElementById("vertex-shader").textContent;
const fragmentSource =
  document.getElementById("fragment-shader").textContent;

// Shader kompilieren
function compileShader(type, source) {
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

const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

// Shader zu einem WebGL-Programm verbinden
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(`Programm-Fehler: ${gl.getProgramInfoLog(program)}`);
}

gl.useProgram(program);

// Rasterkoordinaten (0–600, Ursprung links oben) in WebGL-Koordinaten umwandeln
function toWebGL(x, y) {
  return [
    (x / 600) * 2 - 1,
    1 - (y / 600) * 2
  ];
}

// Drei getrennte Umrisse: Kopf, Körper und Schwanz
const shapes = [
  // Kopf mit Ohren: 8 Vertices
  [
    [230, 190], [210, 90], [275, 145], [300, 135],
    [325, 145], [390, 90], [370, 190], [310, 215], [290, 215]
  ],

  // Auge1
  [
    [260, 170], [280, 180], [280, 170],  [260, 160], 
  ],

  // Auge2
  [
    [330, 170],  [330, 180], [350, 170], [350, 160]
  ],

  //Fuß1
  [ 
    [260, 465], [300, 465], 
    
    
    [300, 485], [290, 485], [290, 480], [290, 485], [280, 485], [280, 480], [280, 485], [270, 485], [270, 480], [270, 485], [260, 485]
  ],

    //Fuß2
  [ 
    [320, 465], [360, 465], 
    
    [360, 485], [350, 485], [350, 480], [350, 485], [340, 485], [340, 480], [340, 485], [330, 485], [330, 480], [330, 485], [320, 485]
  ],

  // Sitzender Körper: 8 Vertices
  [
    [260, 215], [340, 215], [375, 285], [365, 390],
    [340, 465], [275, 465], [240, 390], [225, 285]
  ],

  // Weiße Brust
  [
    [285, 250],
    [315, 250],
    [330, 285],
    [320, 350],
    [305, 385],
    [295, 385],
    [280, 350],
    [270, 285]
  ],

  // Buschiger Schwanz: 8 Vertices
  [
    [369, 330], [415, 320], [485, 330], [450, 365],
    [490, 405], [445, 430], [380, 410], [368, 385]
  ],

    // Arm1 
  [
    [265, 275], [275, 275], [280, 325], [260, 325]
  ],

  //Arm2
  [
    [325, 275], [335, 275], [340, 325], [320, 325]
  ],

  // Schwanz Spitzen
  [
    [485, 330], [465, 328], [462, 353]
  ],
  [
    [490, 405], [465, 419], [460, 375]
  ]
];


// Farben pro Form (RGB-Werte von 0.0 bis 1.0)
const shapeColors = [
  [1.0, 0.45, 0.05], // Kopf: Orange
  [0.05, 0.05, 0.05], // Auge 1: Dunkel
  [0.05, 0.05, 0.05], // Auge 2: Dunkel
  [0.95, 0.75, 0.3],  // Fuß 1
  [0.95, 0.75, 0.3],  // Fuß 2
  [0.9, 0.35, 0.05],  // Körper
  [1, 1, 1,], // Brust
  [0.85, 0.25, 0.03],  // Schwanz
  [0, 0, 0],   // Arm 1
  [0, 0, 0],    // Arm 2
  [0.05, 0.05, 0.05],
  [0.05, 0.05, 0.05]
];

// Hilfsfunktion: Kreuzprodukt für drei 2D-Punkte
function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) -
         (b[1] - a[1]) * (c[0] - a[0]);
}

// Entfernt doppelte und auf einer geraden Linie liegende Punkte.
// Das hilft besonders bei den Fuß-Umrissen.
function cleanShape(shape) {
  let points = [];

  for (const point of shape) {
    const previous = points[points.length - 1];

    if (!previous || point[0] !== previous[0] || point[1] !== previous[1]) {
      points.push(point);
    }
  }

  // Falls der erste und letzte Punkt identisch sind, letzten entfernen.
  if (
    points.length > 1 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
  ) {
    points.pop();
  }

  let changed = true;

  while (changed && points.length > 3) {
    changed = false;

    for (let i = 0; i < points.length; i++) {
      const previous = points[(i - 1 + points.length) % points.length];
      const current = points[i];
      const next = points[(i + 1) % points.length];

      if (Math.abs(cross(previous, current, next)) < 0.001) {
        points.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  return points;
}

// Prüft, ob ein Punkt innerhalb eines Dreiecks liegt.
function pointInTriangle(point, a, b, c) {
  const c1 = cross(a, b, point);
  const c2 = cross(b, c, point);
  const c3 = cross(c, a, point);

  return (
    (c1 >= 0 && c2 >= 0 && c3 >= 0) ||
    (c1 <= 0 && c2 <= 0 && c3 <= 0)
  );
}

// Zerlegt ein Polygon in Dreiecke (Ear-Clipping).
function triangulate(shape) {
  const points = cleanShape(shape);

  if (points.length < 3) {
    return [];
  }

  // Bestimmt die Laufrichtung des Polygons.
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current[0] * next[1] - next[0] * current[1];
  }

  const isCounterClockwise = area > 0;
  const remaining = points.map((_, index) => index);
  const triangles = [];

  while (remaining.length > 3) {
    let earFound = false;

    for (let i = 0; i < remaining.length; i++) {
      const previousIndex =
        remaining[(i - 1 + remaining.length) % remaining.length];
      const currentIndex = remaining[i];
      const nextIndex = remaining[(i + 1) % remaining.length];

      const a = points[previousIndex];
      const b = points[currentIndex];
      const c = points[nextIndex];

      const turn = cross(a, b, c);

      // Eine Ecke muss konvex sein.
      if (isCounterClockwise ? turn <= 0 : turn >= 0) {
        continue;
      }

      // Kein anderer Polygonpunkt darf im Dreieck liegen.
      const containsOtherPoint = remaining.some((index) => {
        if (
          index === previousIndex ||
          index === currentIndex ||
          index === nextIndex
        ) {
          return false;
        }

        return pointInTriangle(points[index], a, b, c);
      });

      if (containsOtherPoint) {
        continue;
      }

      triangles.push([a, b, c]);
      remaining.splice(i, 1);
      earFound = true;
      break;
    }

    // Verhindert eine Endlosschleife, falls ein Umriss fehlerhaft ist.
    if (!earFound) {
      console.warn("Eine Form konnte nicht vollständig trianguliert werden:", shape);
      return triangles;
    }
  }

  // Das letzte verbleibende Dreieck ergänzen.
  if (remaining.length === 3) {
    triangles.push(remaining.map((index) => points[index]));
  }

  return triangles;
}

// Die Dreieckspositionen und Farben für alle Formen erzeugen.
const vertexPositions = [];
const vertexColors = [];

shapes.forEach((shape, shapeIndex) => {
  const triangles = triangulate(shape);
  const color = shapeColors[shapeIndex];

  for (const triangle of triangles) {
    for (const [x, y] of triangle) {
      vertexPositions.push(...toWebGL(x, y));
      vertexColors.push(...color);
    }
  }
});

// Positionen an den Vertex-Shader übergeben.
const positionLocation = gl.getAttribLocation(program, "aPosition");
const positionBuffer = gl.createBuffer();

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array(vertexPositions),
  gl.STATIC_DRAW
);
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

// Farben an den Vertex-Shader übergeben.
const colorLocation = gl.getAttribLocation(program, "aColor");
const colorBuffer = gl.createBuffer();

gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array(vertexColors),
  gl.STATIC_DRAW
);
gl.enableVertexAttribArray(colorLocation);
gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);

// Canvas vorbereiten und alle Dreiecke zeichnen.
gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0.9, 0.9, 0.9, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);

gl.drawArrays(gl.TRIANGLES, 0, vertexPositions.length / 2);