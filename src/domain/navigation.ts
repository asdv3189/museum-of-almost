import type { PublicExhibit } from "./model";
import { resolveJourney, type JourneyStep } from "./journey";

export type MuseumRoute =
  | { view: "gallery" | "atlas" | "curator" }
  | { view: "exhibit"; exhibitId: string; branchId?: string }
  | { view: "unavailable" };

const ID = /^[a-z][a-z0-9-]{1,60}$/;
const unavailable: MuseumRoute = { view: "unavailable" };

// Query routes leave native #main and #collection links available for navigation
// within a page, and work on hosts that serve only the existing app pathname.
export function readMuseumRoute(search: string): MuseumRoute {
  if (search.length > 2048) return unavailable;
  const params = new URLSearchParams(search);
  if (
    ["view", "exhibit", "choice"].some((key) => params.getAll(key).length > 1)
  )
    return unavailable;
  const view = params.get("view");
  const exhibitId = params.get("exhibit");
  const branchId = params.get("choice");
  if (view === "exhibit") {
    if (
      !exhibitId ||
      !ID.test(exhibitId) ||
      (branchId !== null && !ID.test(branchId))
    )
      return unavailable;
    return { view, exhibitId, ...(branchId !== null ? { branchId } : {}) };
  }
  if (exhibitId !== null || branchId !== null) return unavailable;
  if (view === null || view === "exhibition") return { view: "gallery" };
  if (view === "map") return { view: "atlas" };
  if (view === "curator") return { view: "curator" };
  return unavailable;
}

export function museumHref(
  route: Exclude<MuseumRoute, { view: "unavailable" }>,
): string {
  const params = new URLSearchParams();
  params.set(
    "view",
    route.view === "gallery"
      ? "exhibition"
      : route.view === "atlas"
        ? "map"
        : route.view,
  );
  if (route.view === "exhibit") {
    params.set("exhibit", route.exhibitId);
    if (route.branchId !== undefined) params.set("choice", route.branchId);
  }
  return `?${params}`;
}

export function routeSteps(route: MuseumRoute): JourneyStep[] {
  return route.view === "exhibit" && route.branchId !== undefined
    ? [{ exhibitId: route.exhibitId, branchId: route.branchId }]
    : [];
}

// Resolve only after published content has loaded. A syntactically valid link
// must not silently select another object if its exhibit or choice was removed.
export function resolveMuseumRoute(
  route: MuseumRoute,
  exhibits: PublicExhibit[],
): MuseumRoute {
  if (route.view !== "exhibit") return route;
  return resolveJourney(exhibits, route.exhibitId, routeSteps(route))
    .invalidAt === null
    ? route
    : unavailable;
}

interface NavigationHost {
  location: { search: string; hash: string };
  history: {
    pushState(data: unknown, unused: string, url: string): void;
    replaceState(data: unknown, unused: string, url: string): void;
  };
  addEventListener(type: "popstate", listener: () => void): void;
  removeEventListener(type: "popstate", listener: () => void): void;
}

// The same read path handles a pasted URL, refresh, Back and Forward. Pushes
// explicitly notify because the History API does not emit popstate for them.
export function connectMuseumNavigation(
  host: NavigationHost,
  onChange: (route: MuseumRoute, moveFocus: boolean) => void,
) {
  let activeSearch = host.location.search;
  const publish = () => {
    activeSearch = host.location.search;
    onChange(readMuseumRoute(activeSearch), true);
  };
  const restore = () => {
    // Fragment-only navigation belongs to native #main/#collection anchors.
    if (host.location.search !== activeSearch) publish();
  };
  host.addEventListener("popstate", restore);
  // The initial fragment target may not exist until published content loads.
  // Request the component's post-load focus/scroll only for our known targets.
  onChange(
    readMuseumRoute(host.location.search),
    host.location.hash === "#main" || host.location.hash === "#collection",
  );
  return {
    navigate(route: Exclude<MuseumRoute, { view: "unavailable" }>) {
      const href = museumHref(route);
      if (host.location.search !== href) host.history.pushState(null, "", href);
      // A same-view home link has no fragment: honor its actual destination
      // without adding another route entry or retaining #collection scroll.
      else if (host.location.hash) host.history.replaceState(null, "", href);
      publish();
    },
    dispose() {
      host.removeEventListener("popstate", restore);
    },
  };
}

export function isPlainNavigationClick(event: {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
