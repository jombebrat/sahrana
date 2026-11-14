import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";
import Prijava from "./Prijava";

// Линк за породицу изгледа овако: …/sahrana/?p=<токен>
const token = new URLSearchParams(location.search).get("p");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{token ? <Prijava token={token} /> : <App />}</StrictMode>,
);

if (!token && "serviceWorker" in navigator && !import.meta.env.DEV) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
