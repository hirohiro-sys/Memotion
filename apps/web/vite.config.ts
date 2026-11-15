import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Umami の計測スクリプトを本番のビルドにだけ入れる。開発中のアクセスは計測しない。
function umami(): Plugin {
  return {
    name: "memotion-umami",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "script",
        attrs: {
          defer: true,
          src: "https://cloud.umami.is/script.js",
          "data-website-id": "669fc867-d6a1-41aa-8c6f-f3fa146448ed",
        },
        injectTo: "head",
      },
    ],
  };
}

export default defineConfig({
  plugins: [
    umami(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      // public/manifest.webmanifest をそのまま使う。
      manifest: false,
      workbox: {
        // 画面の部品だけを端末に保存する。遅延読み込みのチャンクとフォントも含める。
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,webmanifest}"],
        navigateFallback: "/index.html",
        // LINE ログインなど /api/ への画面遷移は、保存した画面にすり替えずサーバーへ通す。
        navigateFallbackDenylist: [/^\/api\//],
        // /api/ の応答はキャッシュしない（runtimeCaching を持たない）。
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
    },
  },
});
