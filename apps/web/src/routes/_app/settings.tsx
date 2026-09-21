import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { logout } from "@/features/auth/api/logout";
import { SettingsView } from "@/features/notifications/components/settings-view";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleLogout() {
    await logout();
    await queryClient.clear();
    await navigate({ to: "/login" });
  }

  return <SettingsView onLogout={handleLogout} />;
}
