import { describe, it, expect } from "vitest";
import { getInitials, getAvatarColor } from "./helpers.jsx";

describe("helpers", () => {
  it("returns initials from username", () => {
    expect(getInitials("Jane Doe")).toBe("JD");
    expect(getInitials("alice")).toBe("AL");
  });

  it("returns stable avatar color for seed", () => {
    expect(getAvatarColor("alice")).toBe(getAvatarColor("alice"));
    expect(getAvatarColor("alice")).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
