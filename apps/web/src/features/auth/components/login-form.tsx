import { Button } from "@/components/ui/button";

const LOGIN_ERRORS: Record<string, string> = {
  denied: "このアカウントではログインできません",
  cancelled: "ログインがキャンセルされました",
  failed: "ログインに失敗しました",
};

export function LoginForm({ error }: { error?: string }) {
  const message = error ? (LOGIN_ERRORS[error] ?? LOGIN_ERRORS.failed) : "";

  function handleLineLogin() {
    window.location.href = "/api/auth/line";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[360px]">
        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="flex justify-center text-foreground">
            <span className="relative text-[32px] leading-none font-bold tracking-tight">
              <img
                src="/memotion-mark.png"
                alt=""
                className="absolute top-1/2 right-full mr-2.5 size-9 -translate-y-1/2 object-contain dark:invert"
              />
              Memotion
            </span>
          </h1>

          <div className="mt-6 space-y-3">
            {message && (
              <p className="text-caption text-destructive">{message}</p>
            )}
            <Button
              type="button"
              className="w-full bg-foreground text-background hover:bg-foreground/80"
              onClick={handleLineLogin}
            >
              LINEでログイン
            </Button>
          </div>
        </div>
        <p className="mt-4 text-center text-caption text-stone">
          許可されたアカウントのみログインできます
        </p>
      </div>
    </div>
  );
}
