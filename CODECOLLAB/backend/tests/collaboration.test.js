import { canEditSnippet, isSnippetChangePayload } from "../src/utils/collaboration.js";

describe("collaboration access", () => {
  const snippet = {
    ownerId: "owner",
    permissions: [
      { userId: "editor", role: "EDITOR" },
      { userId: "viewer", role: "VIEWER" }
    ]
  };

  test("allows the owner and editors to broadcast changes", () => {
    expect(canEditSnippet(snippet, "owner")).toBe(true);
    expect(canEditSnippet(snippet, "editor")).toBe(true);
  });

  test("does not allow viewers or missing snippets to broadcast changes", () => {
    expect(canEditSnippet(snippet, "viewer")).toBe(false);
    expect(canEditSnippet(null, "owner")).toBe(false);
  });
});

describe("snippet change payload", () => {
  test("accepts a snippet id and string content", () => {
    expect(isSnippetChangePayload({ snippetId: "snippet-1", content: "const x = 1;" })).toBe(true);
  });

  test.each([
    null,
    {},
    { snippetId: "", content: "code" },
    { snippetId: "snippet-1", content: 42 }
  ])("rejects malformed payloads: %p", payload => {
    expect(isSnippetChangePayload(payload)).toBe(false);
  });
});
