// Aplica el tema guardado antes de renderizar (evita parpadeos).
try {
  var t = localStorage.getItem("futowl-theme");
  var dark = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (dark) document.documentElement.classList.add("dark");
} catch (e) {}
