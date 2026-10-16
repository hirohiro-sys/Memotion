import { registerSW } from "virtual:pwa-register";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const router = createRouter({ routeTree });

// 新しいバージョンは待たずに有効化され、プラグインが画面を再読み込みする（autoUpdate）。
// 長く開いたままでも更新に気づけるよう、画面に戻ったときに更新を確認する。
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        // オフラインでは確認に失敗する。次に画面へ戻ったときに再び確認する。
        registration.update().catch(() => undefined);
      }
    });
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("root element not found");
}

if (!rootElement.innerHTML) {
  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
