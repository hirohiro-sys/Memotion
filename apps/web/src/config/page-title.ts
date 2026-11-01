export const APP_NAME = "Memotion";

export const PAGE_TITLES = {
  "/": "メモ一覧",
  "/calendar": "カレンダー",
  "/daily-reports": "日報",
  "/settings": "設定",
  "/login": "ログイン",
} as const;

type AppPath = keyof typeof PAGE_TITLES;

function pageNameForPath(pathname: string): string | undefined {
  if (pathname.startsWith("/daily-reports/")) return "日報";
  return PAGE_TITLES[pathname as AppPath];
}

export function headingForPath(pathname: string): string {
  return pageNameForPath(pathname) ?? PAGE_TITLES["/"];
}

export function documentTitleForPath(pathname: string): string {
  const page = pageNameForPath(pathname);
  return page ? `${page} | ${APP_NAME}` : APP_NAME;
}
