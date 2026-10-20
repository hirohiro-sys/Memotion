import { type FormEvent, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DuplicateGroupNameError } from "../api/errors";

const MAX_NAME_LENGTH = 50;

// グループの作成と名前の変更に使う、名前の入力ダイアログ。
// onSubmit が DuplicateGroupNameError を投げたら入力欄の下に出し、それ以外の失敗は呼び出し側が知らせる。
export function GroupNameDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  initialName = "",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  initialName?: string;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [duplicate, setDuplicate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setDuplicate(false);
  }, [open, initialName]);

  const trimmed = name.trim();
  const canSubmit =
    trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } catch (error) {
      if (error instanceof DuplicateGroupNameError) setDuplicate(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <form onSubmit={handleSubmit}>
          <AlertDialogTitle className="mb-4">{title}</AlertDialogTitle>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setDuplicate(false);
            }}
            placeholder="グループの名前"
            maxLength={MAX_NAME_LENGTH + 20}
            aria-label="グループの名前"
            aria-invalid={duplicate}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-body-sm text-foreground outline-none transition-colors duration-200 placeholder:text-stone focus:border-primary aria-invalid:border-destructive"
          />
          <p className="mt-2 mb-6 min-h-4 text-caption">
            {duplicate ? (
              <span className="text-destructive">
                同じ名前のグループがあります
              </span>
            ) : trimmed.length > MAX_NAME_LENGTH ? (
              <span className="text-destructive">
                {MAX_NAME_LENGTH}文字以内で入力してください
              </span>
            ) : null}
          </p>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button type="button" variant="ghost" size="sm" />}
              disabled={submitting}
            >
              キャンセル
            </AlertDialogClose>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {submitLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
