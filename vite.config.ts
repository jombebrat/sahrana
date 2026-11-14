import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" – апликација ради на било којој путањи (GitHub Pages: /sahrana/).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "es2020", sourcemap: false },
});
