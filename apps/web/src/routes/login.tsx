import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchMe, SessionCheckNetworkError } from "@/features/auth/api/get-me";
import { LoginForm } from "@/features/auth/components/login-form";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search.error === "string" ? { error: search.error } : {},
  beforeLoad: async () => {
    let user: Awaited<ReturnType<typeof fetchMe>>;
    try {
      user = await fetchMe();
    } catch (error) {
      // サーバーに届かないときは、ログイン画面をそのまま出す（エラー画面にしない）。
      if (error instanceof SessionCheckNetworkError) return;
      throw error;
    }
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
