import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchMe } from "@/features/auth/api/get-me";
import { LoginForm } from "@/features/auth/components/login-form";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search.error === "string" ? { error: search.error } : {},
  beforeLoad: async () => {
    const user = await fetchMe();
    if (user) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { error } = Route.useSearch();
  return <LoginForm error={error} />;
}
