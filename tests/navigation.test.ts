import assert from "node:assert/strict";
import test from "node:test";
import { publicExhibits } from "../src/domain/model";
import { resolveJourney } from "../src/domain/journey";
import {
  connectMuseumNavigation,
  isPlainNavigationClick,
  museumHref,
  readMuseumRoute,
  resolveMuseumRoute,
  routeSteps,
  type MuseumRoute,
} from "../src/domain/navigation";
import { fixture, branch } from "./fixtures";

// A browser-history boundary double: URL resolution and the entry stack are
// independent of the routing code, including native fragment-only navigation.
function historyHost(initial: string) {
  const entries = [new URL(initial, "https://museum.example/")];
  let position = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const host = {
    get location() {
      return entries[position];
    },
    history: {
      pushState(_data: unknown, _unused: string, href: string) {
        entries.splice(
          position + 1,
          entries.length,
          new URL(href, entries[position]),
        );
        position += 1;
      },
      replaceState(_data: unknown, _unused: string, href: string) {
        entries[position] = new URL(href, entries[position]);
      },
    },
    addEventListener(_type: "popstate", listener: () => void) {
      listeners.add(listener);
    },
    removeEventListener(_type: "popstate", listener: () => void) {
      listeners.delete(listener);
    },
    back() {
      if (position > 0) {
        position -= 1;
        emit();
      }
    },
    forward() {
      if (position + 1 < entries.length) {
        position += 1;
        emit();
      }
    },
    fragment(hash: string) {
      host.history.pushState(null, "", hash);
      emit();
    },
    get entryCount() {
      return entries.length;
    },
  };
  return host;
}

const exhibits = publicExhibits(fixture());

test("pasted URLs restore each supported view and an optional entry choice", () => {
  for (const route of [
    { view: "gallery" },
    { view: "atlas" },
    { view: "curator" },
    { view: "exhibit", exhibitId: "entrance" },
    { view: "exhibit", exhibitId: "entrance", branchId: "take-clock" },
  ] as const) {
    const host = historyHost(museumHref(route));
    const received: [MuseumRoute, boolean][] = [];
    const connection = connectMuseumNavigation(host, (next, focus) =>
      received.push([next, focus]),
    );
    assert.deepEqual(received, [[route, false]]);
    assert.equal(host.entryCount, 1);
    connection.dispose();
  }
  assert.deepEqual(readMuseumRoute("?utm_source=entry"), { view: "gallery" });
});

test("malformed routes, duplicate reserved keys, and unknown view names are unavailable", () => {
  for (const search of [
    "?view=missing",
    "?view=",
    "?view=map&exhibit=entrance",
    "?choice=take-clock",
    "?exhibit=entrance",
    "?view=exhibit",
    "?view=exhibit&exhibit=",
    "?view=exhibit&exhibit=../entrance",
    "?view=exhibit&exhibit=%E0%A4%A",
    "?view=exhibit&exhibit=entrance&choice=",
    "?view=exhibit&exhibit=entrance&choice=take%2Fclock",
    "?view=map&view=exhibition",
    "?view=exhibit&exhibit=entrance&exhibit=clock-room",
    "?view=exhibit&exhibit=entrance&choice=take-clock&choice=take-garden",
    `?view=exhibit&exhibit=${"a".repeat(62)}`,
    `?x=${"a".repeat(2048)}`,
  ])
    assert.deepEqual(readMuseumRoute(search), { view: "unavailable" }, search);
});

test("initial known fragments request post-load restoration without rewriting the URL or adding history", () => {
  for (const [hash, restore] of [
    ["#main", true],
    ["#collection", true],
    ["#unrecognized", false],
    ["", false],
  ] as const) {
    const host = historyHost(`?view=exhibition${hash}`);
    const received: [MuseumRoute, boolean][] = [];
    const connection = connectMuseumNavigation(host, (route, focus) =>
      received.push([route, focus]),
    );
    assert.deepEqual(received, [[{ view: "gallery" }, restore]], hash);
    assert.equal(host.location.hash, hash);
    assert.equal(host.location.search, "?view=exhibition");
    assert.equal(host.entryCount, 1);
    connection.dispose();
  }
});

test("exhibit URLs resolve against loaded published content, not an empty loading snapshot", () => {
  const route = readMuseumRoute(
    "?view=exhibit&exhibit=entrance&choice=take-clock",
  );
  assert.deepEqual(resolveMuseumRoute(route, []), { view: "unavailable" });
  // Keep the parsed URL independent of data: a delayed successful load restores it.
  assert.deepEqual(resolveMuseumRoute(route, exhibits), route);
  const resolved = resolveJourney(exhibits, "entrance", routeSteps(route));
  assert.deepEqual(
    resolved.stops.map((item) => item.id),
    ["entrance", "clock-room"],
  );
  assert.deepEqual(resolved.consequences, ["You chose take-clock."]);
});

test("unknown or removed exhibits and choices fail visibly rather than selecting a fallback", () => {
  for (const route of [
    { view: "exhibit", exhibitId: "unknown-object" },
    { view: "exhibit", exhibitId: "entrance", branchId: "unknown-choice" },
    { view: "exhibit", exhibitId: "bench-room", branchId: "take-clock" },
  ] as const)
    assert.deepEqual(resolveMuseumRoute(route, exhibits), {
      view: "unavailable",
    });
  const route = {
    view: "exhibit",
    exhibitId: "entrance",
    branchId: "take-clock",
  } as const;
  assert.deepEqual(
    resolveMuseumRoute(
      route,
      exhibits.filter((item) => item.id !== "clock-room"),
    ),
    { view: "unavailable" },
  );
  const corrupt = structuredClone(exhibits);
  corrupt[0].branches = [branch("take-clock", "entrance")];
  assert.deepEqual(resolveMuseumRoute(route, corrupt), { view: "unavailable" });
});

test("Back and Forward restore view, entry object, and the same entry-choice consequence", () => {
  const host = historyHost("?view=map");
  const received: MuseumRoute[] = [];
  const connection = connectMuseumNavigation(host, (route) =>
    received.push(route),
  );
  connection.navigate({ view: "exhibit", exhibitId: "entrance" });
  connection.navigate({
    view: "exhibit",
    exhibitId: "entrance",
    branchId: "take-clock",
  });
  connection.navigate({ view: "gallery" });
  host.back();
  const restored = received.at(-1)!;
  assert.deepEqual(restored, {
    view: "exhibit",
    exhibitId: "entrance",
    branchId: "take-clock",
  });
  assert.deepEqual(
    resolveJourney(exhibits, "entrance", routeSteps(restored)).consequences,
    ["You chose take-clock."],
  );
  host.back();
  assert.deepEqual(received.at(-1), { view: "exhibit", exhibitId: "entrance" });
  assert.deepEqual(routeSteps(received.at(-1)!), []);
  host.back();
  assert.deepEqual(received.at(-1), { view: "atlas" });
  host.forward();
  host.forward();
  assert.deepEqual(received.at(-1), restored);
  connection.dispose();
});

test("refresh has the same URL entry point and does not invent an unsaved downstream journey", () => {
  const host = historyHost("?view=exhibit&exhibit=entrance&choice=take-clock");
  let original: MuseumRoute | undefined;
  const first = connectMuseumNavigation(host, (route) => {
    original = route;
  });
  const localPath = [
    ...routeSteps(original!),
    { exhibitId: "clock-room", branchId: "meet-neighbors" },
  ];
  assert.equal(resolveJourney(exhibits, "entrance", localPath).stops.length, 3);
  first.dispose();
  let restored: MuseumRoute | undefined;
  const reloaded = connectMuseumNavigation(host, (route) => {
    restored = route;
  });
  assert.deepEqual(restored, original);
  assert.equal(
    resolveJourney(exhibits, "entrance", routeSteps(restored!)).stops.length,
    2,
  );
  reloaded.dispose();
});

test("same destination resets its entry point without duplicate history; navigation after Back replaces Forward", () => {
  const host = historyHost("?view=exhibition");
  const received: MuseumRoute[] = [];
  const connection = connectMuseumNavigation(host, (route) =>
    received.push(route),
  );
  connection.navigate({ view: "gallery" });
  assert.equal(host.entryCount, 1);
  assert.equal(received.length, 2);
  connection.navigate({ view: "atlas" });
  connection.navigate({ view: "curator" });
  host.back();
  connection.navigate({ view: "exhibit", exhibitId: "entrance" });
  host.forward();
  assert.equal(host.entryCount, 3);
  assert.deepEqual(received.at(-1), { view: "exhibit", exhibitId: "entrance" });
  connection.dispose();
});

test("native main/collection fragments do not reset view state or request route focus", () => {
  const host = historyHost("?view=exhibition");
  const received: MuseumRoute[] = [];
  const connection = connectMuseumNavigation(host, (route) =>
    received.push(route),
  );
  host.fragment("#collection");
  host.fragment("#main");
  host.back();
  assert.equal(received.length, 1);
  assert.equal(host.location.hash, "#collection");
  connection.navigate({ view: "atlas" });
  host.back();
  assert.deepEqual(received.at(-1), { view: "gallery" });
  assert.equal(host.location.hash, "#collection");
  connection.dispose();
  const count = received.length;
  host.forward();
  assert.equal(received.length, count);
});

test("a same-view home link clears the collection fragment without another history entry", () => {
  const host = historyHost("?view=exhibition");
  const received: [MuseumRoute, boolean][] = [];
  const connection = connectMuseumNavigation(host, (route, focus) =>
    received.push([route, focus]),
  );
  host.fragment("#collection");
  assert.equal(host.entryCount, 2);
  connection.navigate({ view: "gallery" });
  assert.equal(host.location.hash, "");
  assert.equal(host.location.search, "?view=exhibition");
  assert.equal(host.entryCount, 2);
  assert.deepEqual(received.at(-1), [{ view: "gallery" }, true]);
  connection.dispose();
});

test("modified clicks, non-primary buttons and prevented events retain native link handling", () => {
  const plain = {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
  };
  assert.equal(isPlainNavigationClick(plain), true);
  for (const override of [
    { defaultPrevented: true },
    { button: 1 },
    { button: 2 },
    { metaKey: true },
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
  ])
    assert.equal(isPlainNavigationClick({ ...plain, ...override }), false);
});
