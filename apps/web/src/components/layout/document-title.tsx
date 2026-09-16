import { useRouterState } from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import { documentTitleForPath } from "@/config/page-title";

export function DocumentTitle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = documentTitleForPath(pathname);

  useLayoutEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}
