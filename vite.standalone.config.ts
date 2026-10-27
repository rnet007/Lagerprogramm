import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig({
  define:{'import.meta.env.VITE_OFFLINE_DEMO':JSON.stringify('true')},
  plugins: [viteSingleFile()],
  build: { outDir: "standalone" },
});
