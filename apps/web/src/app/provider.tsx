import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";

// TanStack Query は起動時を「オンライン」とみなし、online / offline イベントでしか更新しない。
// 機内モードのまま起動したときも取得を「待機中」にできるよう、起動時の状態を伝える。
onlineManager.setOnline(navigator.onLine);

const queryClient = new QueryClient();

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
