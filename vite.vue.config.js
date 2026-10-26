import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: "dist/vue",
    minify: false,
    lib: { entry: "src/main.js", formats: ["es"], fileName: "main" },
  },
});
