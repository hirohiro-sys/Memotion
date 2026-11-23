import { createRootRoute, Navigate, Outlet } from "@tanstack/react-router";
import { AppProvider } from "@/app/provider";
import { DocumentTitle } from "@/components/layout/document-title";

function RootLayout() {
  return (
    <AppProvider>
      <DocumentTitle />
      <Outlet />
    </AppProvider>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  // 消した画面（/calendar、/settings など）のブックマークは、投入画面へ移す。
  notFoundComponent: () => <Navigate to="/" replace />,
});
