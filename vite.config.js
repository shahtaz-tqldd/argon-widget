import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: {
    port: 5175,
    strictPort: true,
    cors: true,
  },
  build: mode === "widget" ? {
    lib: {
      entry: "src/widget/index.jsx",
      name: "ArgonChatbot",
      formats: ["iife"],
      fileName: () => "argon-widget.js",
    },
    cssCodeSplit: false,
  } : undefined,
}));
