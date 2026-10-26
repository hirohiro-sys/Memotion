import { createFileRoute } from "@tanstack/react-router";
import { CalendarView } from "@/features/schedule/components/calendar-view";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarView,
});
