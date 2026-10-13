import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port fixe : Tauri pointe dessus en dev (voir src-tauri/tauri.conf.json).
// host : le téléphone en `tauri android dev` charge l'interface depuis le PC.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: process.env.TAURI_DEV_HOST || false },
});
