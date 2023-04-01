if (
  // Disable service worker on localhost for easier development
  !window.location.hostname.startsWith("localhost") &&
  "serviceWorker" in navigator
) {
  navigator.serviceWorker.register("/sw.js");
}
