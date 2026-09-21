import { createRootRoute, Outlet } from "@tanstack/react-router";
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
});
