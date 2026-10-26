import { defineConfig } from "vite";
import vize from "@vizejs/vite-plugin";

export default defineConfig({
  plugins: [vize()],
  build: {
    outDir: "dist/vize",
    minify: false,
    lib: { entry: "src/main.js", formats: ["es"], fileName: "main" },
  },
});
