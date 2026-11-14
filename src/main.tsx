import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/old-standard-tt/cyrillic-400.css";
import "@fontsource/old-standard-tt/cyrillic-700.css";
import "@fontsource/old-standard-tt/latin-400.css";
import "@fontsource/old-standard-tt/latin-700.css";
import "@fontsource/old-standard-tt/latin-ext-400.css";
import "@fontsource/old-standard-tt/latin-ext-700.css";
import "@fontsource/golos-text/cyrillic-400.css";
import "@fontsource/golos-text/cyrillic-500.css";
import "@fontsource/golos-text/cyrillic-600.css";
import "@fontsource/golos-text/latin-400.css";
import "@fontsource/golos-text/latin-500.css";
import "@fontsource/golos-text/latin-600.css";
import "@fontsource/golos-text/latin-ext-400.css";
import "@fontsource/golos-text/latin-ext-500.css";
import "@fontsource/golos-text/latin-ext-600.css";
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
