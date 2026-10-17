import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Canal (README, « Dev et prod »), le même que lisent src-tauri/build.rs et build.gradle.kts.
const canal = process.env.EXZIFIT_CANAL ?? "dev";
if (canal !== "dev" && canal !== "prod") throw new Error(`EXZIFIT_CANAL=${canal} : attendu dev ou prod`);

// Port fixe : Tauri pointe dessus en dev (voir src-tauri/tauri.conf.json).
// host : le téléphone en `tauri android dev` charge l'interface depuis le PC.
export default defineConfig({
  plugins: [react()],
  define: { __CANAL__: JSON.stringify(canal) },
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: process.env.TAURI_DEV_HOST || false },
});
