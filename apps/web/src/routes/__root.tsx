import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AppProvider } from "@/app/provider";
import { DocumentTitle } from "@/components/layout/document-title";

function RootLayout() {
  return (
    <AppProvider>
      <DocumentTitle />
      <Outlet />
      <TanStackRouterDevtools />
    </AppProvider>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
