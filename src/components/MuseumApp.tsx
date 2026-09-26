"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { PublicExhibit } from "@/domain/model";
import {
  connectMuseumNavigation,
  isPlainNavigationClick,
  museumHref,
  resolveMuseumRoute,
  routeSteps,
  type MuseumRoute,
} from "@/domain/navigation";
import { Gallery } from "./Gallery";
import { Explorer } from "./Explorer";
import { Atlas } from "./Atlas";
import { Workbench } from "./Workbench";

export function MuseumApp() {
  const [location, setLocation] = useState<{
    route: MuseumRoute;
    generation: number;
    moveFocus: boolean;
  }>({ route: { view: "gallery" }, generation: 0, moveFocus: false });
  const navigation = useRef<ReturnType<typeof connectMuseumNavigation> | null>(
    null,
  );
  const main = useRef<HTMLElement>(null);
  const focusedGeneration = useRef(0);
  const [exhibits, setExhibits] = useState<PublicExhibit[]>([]);
  const [mode, setMode] = useState<"local" | "sanity">("local");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const route = resolveMuseumRoute(location.route, exhibits);
  const view = route.view;

  async function refresh() {
    const response = await fetch("/api/museum", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setExhibits(result.exhibits);
    setMode(result.mode);
    setError("");
  }

  useEffect(() => {
    const controller = connectMuseumNavigation(
      window,
      (nextRoute, moveFocus) => {
        setLocation((previous) => ({
          route: nextRoute,
          generation: previous.generation + 1,
          moveFocus,
        }));
      },
    );
    navigation.current = controller;
    return () => {
      controller.dispose();
      navigation.current = null;
    };
  }, []);

  useEffect(() => {
    refresh()
      .catch((failure) => setError(failure.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (
      loading ||
      error ||
      !location.moveFocus ||
      focusedGeneration.current === location.generation
    )
      return;
    focusedGeneration.current = location.generation;
    const fragmentTarget =
      window.location.hash === "#collection"
        ? main.current?.querySelector<HTMLElement>("#collection")
        : window.location.hash === "#main"
          ? main.current
          : null;
    const target =
      fragmentTarget ??
      main.current?.querySelector<HTMLElement>("h1") ??
      main.current;
    target?.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
    if (fragmentTarget)
      fragmentTarget.scrollIntoView({ behavior: "instant", block: "start" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, [loading, error, location.generation, location.moveFocus]);

  function navigate(next: Exclude<MuseumRoute, { view: "unavailable" }>) {
    if (navigation.current) navigation.current.navigate(next);
    else window.location.assign(museumHref(next));
  }
  function followLink(
    event: MouseEvent<HTMLAnchorElement>,
    next: Exclude<MuseumRoute, { view: "unavailable" }>,
  ) {
    if (
      !isPlainNavigationClick(event) ||
      event.currentTarget.target ||
      !navigation.current
    )
      return;
    event.preventDefault();
    navigate(next);
  }
  function openExhibit(id: string) {
    navigate({ view: "exhibit", exhibitId: id });
  }
  function openBranch(exhibitId: string, branchId: string) {
    navigate({ view: "exhibit", exhibitId, branchId });
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to exhibition
      </a>
      <header className="site-header">
        <a
          className="wordmark"
          href={museumHref({ view: "gallery" })}
          onClick={(event) => followLink(event, { view: "gallery" })}
          aria-label="Museum of Almost home"
        >
          <span className="brand-icon">
            a<span>.</span>
          </span>
          <span>
            THE MUSEUM
            <br />
            OF ALMOST
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a
            href={museumHref({ view: "gallery" })}
            aria-current={
              view === "gallery" || view === "exhibit" ? "page" : undefined
            }
            onClick={(event) => followLink(event, { view: "gallery" })}
          >
            The exhibition
          </a>
          <a
            href={museumHref({ view: "atlas" })}
            aria-current={view === "atlas" ? "page" : undefined}
            onClick={(event) => followLink(event, { view: "atlas" })}
          >
            Possibility map
          </a>
          <a
            href={museumHref({ view: "curator" })}
            className="curator-nav"
            aria-current={view === "curator" ? "page" : undefined}
            onClick={(event) => followLink(event, { view: "curator" })}
          >
            Curator room <span>↗</span>
          </a>
        </nav>
      </header>
      <main id="main" ref={main} tabIndex={-1}>
        {loading ? (
          <div className="loading-state">
            <span className="loading-flower">✳</span>
            <p>Opening a few possibilities…</p>
          </div>
        ) : error ? (
          <div className="empty-state" role="alert">
            <span className="eyebrow">THE DOOR IS TEMPORARILY CLOSED</span>
            <h1>The collection could not be loaded.</h1>
            <p>{error}</p>
            <button
              className="button button-dark"
              onClick={() => {
                setLoading(true);
                refresh()
                  .catch((failure) => setError(failure.message))
                  .finally(() => setLoading(false));
              }}
            >
              Try again ↗
            </button>
          </div>
        ) : (
          <>
            {view === "gallery" && (
              <Gallery exhibits={exhibits} onNavigate={followLink} />
            )}
            {route.view === "exhibit" && (
              <Explorer
                key={location.generation}
                exhibits={exhibits}
                startId={route.exhibitId}
                initialSteps={routeSteps(route)}
                onBack={() => navigate({ view: "gallery" })}
              />
            )}
            {view === "atlas" && (
              <Atlas
                exhibits={exhibits}
                onOpen={openExhibit}
                onBranch={openBranch}
              />
            )}
            {view === "curator" && (
              <Workbench mode={mode} onPublished={refresh} />
            )}
            {view === "unavailable" && (
              <div className="empty-state" role="status">
                <span className="eyebrow">A POSSIBILITY WE COULD NOT FIND</span>
                <h1>This museum link is unavailable.</h1>
                <p>
                  The address may be incomplete, or its object or choice is no
                  longer on the wall.
                </p>
                <a
                  className="button button-dark"
                  href={museumHref({ view: "gallery" })}
                  onClick={(event) => followLink(event, { view: "gallery" })}
                >
                  Explore the collection <span>↗</span>
                </a>
              </div>
            )}
          </>
        )}
      </main>
      <footer className="site-footer">
        <div>
          <a
            className="footer-wordmark"
            href={museumHref({ view: "gallery" })}
            onClick={(event) => followLink(event, { view: "gallery" })}
          >
            The Museum of <em>Almost.</em>
          </a>
          <p>For the futures that still have something to say.</p>
        </div>
        <div className="footer-note">
          <span>AN ORIGINAL FICTIONAL EXHIBITION</span>
          <span>
            {mode === "local"
              ? "Local prototype · Sanity connection pending"
              : "Content served from Sanity"}
          </span>
          <span>
            Made with curiosity. Open to possibility. <b>✳</b>
          </span>
        </div>
      </footer>
    </>
  );
}
