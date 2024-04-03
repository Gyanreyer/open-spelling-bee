const randomInRange = (min, max) => Math.random() * (max - min) + min;

let confettiPromise = null;

// Uses tsparticles-confetti to fire a fancy confetti effect for celebrations
window.fireConfetti = async (canvasId) => {
  try {
    if (!confettiPromise) {
      confettiPromise = import(
        "https://cdn.jsdelivr.net/npm/@tsparticles/confetti@3.0.3/tsparticles.confetti.bundle.min.js/+esm"
      );
    }
    const confettiModule = await confettiPromise;
    const confetti = confettiModule.default.confetti;
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
  } catch (e) {
    console.error("Failed to fire confetti and ruined the party :(", e);
  }
};
