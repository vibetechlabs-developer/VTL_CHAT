/**
 * Helpers for DRF cursor-paginated API responses ({ results, next, previous }).
 */

export function normalizePage(data) {
  if (Array.isArray(data)) {
    return { results: data, next: null, previous: null };
  }
  return {
    results: data?.results ?? [],
    next: data?.next ?? null,
    previous: data?.previous ?? null,
  };
}

export function mergeById(existing, incoming) {
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

export function prependById(existing, incoming) {
  const seen = new Set(existing.map((item) => item.id));
  const prepend = incoming.filter((item) => !seen.has(item.id));
  return [...prepend, ...existing];
}

/** Newest-first API pages → chronological order for chat display. */
export function toChronological(messages) {
  return [...messages].reverse();
}

export async function fetchCursorPage(requestFn) {
  const res = await requestFn();
  return normalizePage(res.data);
}

export async function fetchAllPages(initialRequest, followNext = (page) => page.next) {
  let page = await fetchCursorPage(initialRequest);
  let results = [...page.results];
  let nextUrl = followNext(page);

  while (nextUrl) {
    page = await fetchCursorPage(() => initialRequest(nextUrl));
    results = mergeById(results, page.results);
    nextUrl = followNext(page);
  }

  return results;
}

export async function fetchAllCursorPages(requestForUrl) {
  let page = await fetchCursorPage(() => requestForUrl());
  let results = [...page.results];
  let nextUrl = page.next;

  while (nextUrl) {
    page = await fetchCursorPage(() => requestForUrl(nextUrl));
    results = mergeById(results, page.results);
    nextUrl = page.next;
  }

  return results;
}
