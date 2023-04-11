const randomInRange = (min, max) => Math.random() * (max - min) + min;

// Uses tsparticles-confetti to fire a fancy confetti effect for celebrations
window.fireConfetti = async (canvasId) => {
  const canvas = document.getElementById(canvasId);

  // you should  only initialize a canvas once, so save this function
  // we'll save it to the canvas itself for the purpose of this demo
  canvas.confetti = canvas.confetti || (await confetti.create(canvas));

  canvas.confetti({
    angle: randomInRange(75, 105),
    spread: randomInRange(50, 70),
    particleCount: randomInRange(30, 45),
    origin: { y: 0.8 },
  });
};
