// Pfade zu den Einzelbildern
const frames = [
  "scheibe/images/1.png",
  "scheibe/images/2.png",
  "scheibe/images/3.png",
  "scheibe/images/4.png",
  "scheibe/images/5.png",
  "scheibe/images/6.png",
  "scheibe/images/7.png",
  "scheibe/images/8.png",
  "scheibe/images/9.png",
  "scheibe/images/10.png",
  "scheibe/images/11.png",
  "scheibe/images/12.png"
];

const disc = document.querySelector("#disc");
const leftButton = document.querySelector("#leftButton");
const rightButton = document.querySelector("#rightButton");

let currentFrame = 0;
let animationTimer = null;
const frameDauer = 75; // Millisekunden pro Bild

// Zeigt das Bild am aktuellen Index an
function showFrame() {
  disc.src = frames[currentFrame];
}

// Ein Schritt nach rechts
rightButton.addEventListener("click", () => {
  currentFrame = (currentFrame + 1) % frames.length;
  showFrame();
});

// Ein Schritt nach links
leftButton.addEventListener("click", () => {
  currentFrame = (currentFrame - 1 + frames.length) % frames.length;
  showFrame();
});

// Animation mit der Taste „a“ starten oder anhalten
function toggleAnimation() {
  if (animationTimer === null) {
    animationTimer = setInterval(() => {
      currentFrame = (currentFrame + 1) % frames.length;
      showFrame();
    }, frameDauer);
  } else {
    clearInterval(animationTimer);
    animationTimer = null;
  }
}

document.addEventListener("keydown", (event) => {
  const taste = event.key.toLowerCase();

  if (taste === "a") {
    toggleAnimation();
  } else if (taste === "l") {
    currentFrame = (currentFrame - 1 + frames.length) % frames.length;
    showFrame();
  } else if (taste === "r") {
    currentFrame = (currentFrame + 1) % frames.length;
    showFrame();
  }
});