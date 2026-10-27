"use strict";

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

  // Arm1 
  [
    [265, 275], [275, 275], [280, 325], [260, 325]
  ],

  //Arm2
  [
    [325, 275], [335, 275], [340, 325], [320, 325]
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

  // Buschiger Schwanz: 8 Vertices
  [
    [369, 330], [415, 320], [485, 330], [450, 365],
    [490, 405], [445, 430], [380, 410], [368, 385]
  ]
];


// Das Shader-Attribut für die Vertex-Position finden
const positionLocation = gl.getAttribLocation(program, "aPosition");
gl.enableVertexAttribArray(positionLocation);

// Canvas vorbereiten
gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0.9, 0.9, 0.9, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);

// Einen Buffer für die Geometriedaten anlegen
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

// Alle Formen zeichnen
for (const shape of shapes) {
  const vertices = new Float32Array(
    shape.flatMap(([x, y]) => toWebGL(x, y))
  );

  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // LINE_LOOP verbindet die Punkte der Reihe nach und schließt die Form
  gl.drawArrays(gl.LINE_LOOP, 0, vertices.length / 2);
}