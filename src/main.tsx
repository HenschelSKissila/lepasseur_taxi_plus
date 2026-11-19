import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/app.css";

// Thème automatique : suit le système si l'utilisateur n'a rien choisi.
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
  if ((localStorage.getItem("lptp-theme") || "auto") === "auto") document.documentElement.dataset.theme = e.matches ? "dark" : "light";
});

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
