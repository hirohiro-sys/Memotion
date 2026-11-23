export const APP_NAME = "Memotion";

export const PAGE_TITLES = {
  "/login": "ログイン",
} as const;

type AppPath = keyof typeof PAGE_TITLES;

function pageNameForPath(pathname: string): string | undefined {
  return PAGE_TITLES[pathname as AppPath];
}

export function documentTitleForPath(pathname: string): string {
  const page = pageNameForPath(pathname);
  return page ? `${page} | ${APP_NAME}` : APP_NAME;
}
