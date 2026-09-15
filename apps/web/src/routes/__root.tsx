import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { DocumentTitle } from "@/components/layout/document-title";
import { Toaster } from "@/components/ui/toast";

const queryClient = new QueryClient();

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <DocumentTitle />
      <Outlet />
      <Toaster />
      <TanStackRouterDevtools />
    </QueryClientProvider>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
