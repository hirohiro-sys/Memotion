const STORAGE_KEY = "memotion_sidebar";

export function getStoredSidebarCollapsed(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "collapsed";
}

export function setStoredSidebarCollapsed(collapsed: boolean) {
  localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "expanded");
}
