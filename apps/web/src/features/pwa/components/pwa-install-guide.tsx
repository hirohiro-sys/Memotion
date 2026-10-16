import { ChevronDown } from "lucide-react";

const GUIDES = [
  {
    title: "iPhone（Safari）",
    steps: [
      "Safari で Memotion を開く",
      "画面下の共有ボタン（四角から上向きの矢印）をタップする。見当たらないときは「…」から「共有」を開く",
      "「ホーム画面に追加」を選ぶ",
      "右上の「追加」をタップする",
    ],
  },
  {
    title: "Mac（Safari）",
    steps: [
      "Safari で Memotion を開く",
      "メニューバーの「ファイル」から「Dock に追加」を選ぶ",
      "「追加」をクリックする",
    ],
  },
  {
    title: "Mac（Chrome）",
    steps: [
      "Chrome で Memotion を開く",
      "アドレスバー右端のインストールのアイコンをクリックする。見当たらないときは、右上のメニュー（︙）の「キャスト、保存、共有」から「ページをアプリとしてインストール」を選ぶ",
      "「インストール」をクリックする",
    ],
  },
] as const;

export function PwaInstallGuide() {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-2 text-subheading font-bold text-foreground">
        アプリとして使う
      </h3>
      <p className="mb-6 text-body-sm text-stone">
        ホーム画面や Dock
        に追加すると、ブラウザを開かずにアイコンから起動できます。
      </p>

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {GUIDES.map((guide) => (
          <details key={guide.title} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-body-sm text-foreground transition-colors duration-200 hover:bg-muted [&::-webkit-details-marker]:hidden">
              {guide.title}
              <ChevronDown className="size-4 shrink-0 text-stone transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <ol className="list-decimal space-y-1.5 px-4 pt-1 pb-4 pl-9 text-body-sm text-graphite">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        ))}
      </div>

      <div className="mt-6">
        <p className="text-body-sm text-foreground">オフラインでの追加</p>
        <p className="mt-0.5 text-caption text-stone">
          電波がないときに追加したメモは、一覧に「送信待ち」として残ります。オンラインに戻ったあと、アプリを開いたときや画面に戻ったときに、自動で送信されます。オフラインで追加したメモは「つぶやき」になります。
        </p>
      </div>
    </section>
  );
}
