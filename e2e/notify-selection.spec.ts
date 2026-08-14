import { test, expect } from "@playwright/test";
import {
  countSelected,
  selectedRoles,
  toggleVisibleSelection,
  visibleUsersFor,
} from "../src/lib/notify-selection";

const USERS = [
  { id: "s1", role: "STUDENT" as const },
  { id: "s2", role: "STUDENT" as const },
  { id: "t1", role: "TA" as const },
  { id: "p1", role: "PROFESSOR" as const },
];

test.describe("notify recipient selection", () => {
  test("role filter only narrows the view", () => {
    expect(visibleUsersFor(USERS, "ALL")).toHaveLength(4);
    expect(visibleUsersFor(USERS, "STUDENT").map((u) => u.id)).toEqual(["s1", "s2"]);
  });

  test("Select All on a filtered role leaves other roles untouched", () => {
    const selected = new Set(["t1"]);
    const students = visibleUsersFor(USERS, "STUDENT");

    const next = toggleVisibleSelection(selected, students);

    expect(Array.from(next).sort()).toEqual(["s1", "s2", "t1"]);
  });

  test("Deselect All on a filtered role keeps hidden selections", () => {
    const selected = new Set(["s1", "s2", "t1", "p1"]);
    const students = visibleUsersFor(USERS, "STUDENT");

    const next = toggleVisibleSelection(selected, students);

    expect(Array.from(next).sort()).toEqual(["p1", "t1"]);
  });

  test("hidden selected count is everything outside the current filter", () => {
    const selected = new Set(["s1", "t1", "p1"]);
    const students = visibleUsersFor(USERS, "STUDENT");

    const visibleSelected = countSelected(students, selected);

    expect(visibleSelected).toBe(1);
    expect(selected.size - visibleSelected).toBe(2);
  });

  test("audience roles come from the whole selection, not the filter", () => {
    expect(selectedRoles(USERS, new Set(["s1", "t1"])).sort()).toEqual(["STUDENT", "TA"]);
    expect(selectedRoles(USERS, new Set())).toEqual([]);
  });

  test("toggling an empty visible list is a no-op", () => {
    const selected = new Set(["s1"]);
    expect(Array.from(toggleVisibleSelection(selected, []))).toEqual(["s1"]);
  });
});
