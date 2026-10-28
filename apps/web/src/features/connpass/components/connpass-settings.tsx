import { connpassNicknameSchema } from "@repo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useOnlineStatus } from "@/features/memos/offline/use-online-status";
import { ConnpassError } from "../api/connpass-error";
import { fetchConnpassSettings } from "../api/get-connpass-settings";
import { syncConnpass } from "../api/sync-connpass";
import { updateConnpassSettings } from "../api/update-connpass-settings";

function formatSyncedAt(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function saveErrorMessage(error: unknown): string {
  if (error instanceof ConnpassError) {
    if (error.code === "connpass_user_not_found") {
      return "connpass にそのユーザー名が見つかりません。";
    }
    if (error.code === "connpass_unavailable") {
      return "connpass に接続できませんでした。時間をおいてお試しください。";
    }
  }
  return "保存できませんでした。";
}

function syncErrorMessage(error: unknown): string {
  if (error instanceof ConnpassError) {
    if (error.code === "connpass_sync_too_soon") {
      return "少し待ってからもう一度お試しください。";
    }
    if (error.code === "connpass_not_configured") {
      return "connpass のユーザー名を保存してください。";
    }
    if (error.code === "connpass_unavailable") {
      return "connpass から取り込めませんでした。";
    }
  }
  return "取り込めませんでした。";
}

// connpass で参加登録したイベントを、予定として取り込む設定。
export function ConnpassSettings() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const settingsQuery = useQuery({
    queryKey: ["connpass"],
    queryFn: fetchConnpassSettings,
  });
  const settings = settingsQuery.data;
  const saved = settings?.nickname ?? "";
  const [draft, setDraft] = useState("");
  useEffect(() => setDraft(saved), [saved]);

  const saveMutation = useMutation({
    mutationFn: updateConnpassSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["connpass"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: syncConnpass,
    onSuccess: async (result) => {
      const counts = `${result.created}件追加・${result.updated}件更新・${result.deleted}件削除`;
      toast.add({
        title: result.complete
          ? `取り込みました（${counts}）`
          : `一部だけ取り込みました（${counts}）`,
        type: "success",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["connpass"] }),
        queryClient.invalidateQueries({ queryKey: ["memos"] }),
      ]);
    },
    onError: async (error) => {
      toast.add({ title: syncErrorMessage(error), type: "error" });
      // 一部だけ反映されて失敗することがあるので、予定も取り直す。
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["connpass"] }),
        queryClient.invalidateQueries({ queryKey: ["memos"] }),
      ]);
    },
  });

  const trimmed = draft.trim();
  const invalidNickname =
    trimmed !== "" && !connpassNicknameSchema.safeParse(trimmed).success;
  const busy = saveMutation.isPending || syncMutation.isPending;
  const offline =
    settings === undefined && settingsQuery.fetchStatus === "paused";

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-6 text-subheading font-bold text-foreground">
        connpass 連携
      </h3>

      {offline && (
        <p className="flex items-center gap-2 text-body-sm text-stone">
          <CloudOff className="size-4 shrink-0" />
          オフラインのため設定を取得できません
        </p>
      )}

      {settingsQuery.isPending && !offline && (
        <div className="space-y-3" role="status" aria-label="読み込み中">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}

      {settingsQuery.isError && !offline && (
        <p className="text-body-sm text-destructive">
          connpass の設定を取得できませんでした
        </p>
      )}

      {settings && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed === "" || trimmed === saved) return;
            saveMutation.mutate({ nickname: trimmed });
          }}
        >
          <div>
            <label
              htmlFor="connpass-nickname"
              className="mb-1.5 block text-caption text-stone"
            >
              connpass のユーザー名
            </label>
            <div className="flex gap-2">
              <input
                id="connpass-nickname"
                type="text"
                value={draft}
                maxLength={50}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="https://connpass.com/user/○○/ の ○○"
                onChange={(event) => {
                  setDraft(event.target.value);
                  saveMutation.reset();
                }}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-body-sm outline-none transition-colors duration-200 focus:border-primary"
              />
              <Button
                type="submit"
                size="sm"
                disabled={
                  busy ||
                  !online ||
                  trimmed === "" ||
                  trimmed === saved ||
                  invalidNickname
                }
                title={online ? undefined : "オフラインのため使えません"}
              >
                保存
              </Button>
            </div>
            {invalidNickname ? (
              <p className="mt-1.5 text-caption text-destructive" role="alert">
                使える文字は、英数字・「_」・「-」で、50文字までです。
              </p>
            ) : null}
            {saveMutation.isError ? (
              <p className="mt-1.5 text-caption text-destructive" role="alert">
                {saveErrorMessage(saveMutation.error)}
              </p>
            ) : null}
          </div>

          {settings.nickname ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption text-stone">
                {settings.lastSyncedAt
                  ? `最後の取り込み: ${formatSyncedAt(settings.lastSyncedAt)}${settings.lastSyncStatus === "failed" ? "（失敗）" : ""}`
                  : "まだ取り込んでいません（1分以内に始まります）"}
              </p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={busy || !online}
                  title={online ? undefined : "オフラインのため使えません"}
                  onClick={() => saveMutation.mutate({ nickname: null })}
                  className="text-stone"
                >
                  連携をやめる
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  disabled={busy || !online}
                  title={online ? undefined : "オフラインのため使えません"}
                  onClick={() => syncMutation.mutate()}
                >
                  <RefreshCw
                    className={syncMutation.isPending ? "animate-spin" : ""}
                  />
                  今すぐ取り込む
                </Button>
              </div>
            </div>
          ) : null}

          <p className="text-caption text-stone">
            参加登録した今日以降のイベントを、1時間ごとに予定として取り込みます。ユーザー名を変えると、前のユーザー名で取り込んだ今後の予定は消えます。Memotion
            で消した予定は、取り込み直しても戻りません。
          </p>
        </form>
      )}
    </section>
  );
}
