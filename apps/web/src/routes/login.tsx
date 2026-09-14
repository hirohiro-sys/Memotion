import { createFileRoute, redirect } from "@tanstack/react-router";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { Button } from "@/components/ui/button";
import { fetchMe } from "@/lib/api";

const LOGIN_ERRORS: Record<string, string> = {
  denied: "このアカウントではログインできません",
  cancelled: "ログインがキャンセルされました",
  failed: "ログインに失敗しました",
};

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
  const message = error ? (LOGIN_ERRORS[error] ?? LOGIN_ERRORS.failed) : "";

  function handleLineLogin() {
    window.location.href = "/api/auth/line";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[360px] rounded-xl border border-border bg-card p-6">
        <BrandLockup as="h1" />

        <div className="mt-6 space-y-4">
          {message && (
            <p className="text-caption text-destructive">{message}</p>
          )}

          <Button type="button" className="w-full" onClick={handleLineLogin}>
            LINEでログイン
          </Button>
        </div>
      </div>
    </div>
  );
}
