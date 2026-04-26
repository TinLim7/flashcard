export function buildDeckDetailHref(deckId: string) {
  return `/decks/detail?deckId=${encodeURIComponent(deckId)}`;
}

export function buildDeckCardNewHref(deckId: string) {
  return `/decks/card/new?deckId=${encodeURIComponent(deckId)}`;
}

export function buildStudySessionHref(sessionId: string) {
  return `/study/session?sessionId=${encodeURIComponent(sessionId)}`;
}

export function buildStudyDoneHref(sessionId: string) {
  return `/study/done?sessionId=${encodeURIComponent(sessionId)}`;
}

export function getPageBackFallbackHref(pathname: string | null | undefined) {
  if (!pathname || pathname === "/" || pathname === "/app") {
    return "/app";
  }

  if (pathname === "/study") {
    return "/app";
  }

  if (pathname.startsWith("/study/session") || pathname.startsWith("/study/done")) {
    return "/study";
  }

  if (
    pathname.startsWith("/decks/detail") ||
    pathname.startsWith("/decks/new") ||
    pathname.startsWith("/decks/card/new")
  ) {
    return "/decks";
  }

  if (
    pathname === "/decks" ||
    pathname === "/confusions" ||
    pathname === "/import" ||
    pathname === "/stats" ||
    pathname === "/settings" ||
    pathname === "/offline"
  ) {
    return "/app";
  }

  return "/app";
}
