export function canEditSnippet(snippet, userId) {
  return Boolean(
    snippet &&
      (snippet.ownerId === userId ||
        snippet.permissions?.some(permission => permission.userId === userId && permission.role === "EDITOR"))
  );
}

export function isSnippetChangePayload(payload) {
  return Boolean(
    payload &&
      typeof payload.snippetId === "string" &&
      payload.snippetId.length > 0 &&
      typeof payload.content === "string"
  );
}
