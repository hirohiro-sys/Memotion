import { describe, expect, it } from "vitest";
import { isDailyReportUniqueViolation } from "./constraint-error";

describe("isDailyReportUniqueViolation", () => {
  it("reads the unique failure from the cause, not the query wrapper", () => {
    const wrapper = new Error(
      "Failed query: insert into daily_reports (body) values ('本文')",
    );
    wrapper.cause = new Error(
      "UNIQUE constraint failed: daily_reports.user_id, daily_reports.report_date, daily_reports.kind",
    );
    expect(isDailyReportUniqueViolation(wrapper)).toBe(true);
  });

  it("ignores a unique mention that only appears inside the query wrapper", () => {
    const wrapper = new Error(
      "Failed query: insert into daily_reports (body) values ('UNIQUE constraint failed: daily_reports.user_id')",
    );
    wrapper.cause = new Error("no such table");
    expect(isDailyReportUniqueViolation(wrapper)).toBe(false);
  });

  it("does not treat another table's unique failure as a daily report collision", () => {
    expect(
      isDailyReportUniqueViolation(
        new Error("UNIQUE constraint failed: memos.line_message_id"),
      ),
    ).toBe(false);
  });
});
