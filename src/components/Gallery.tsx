"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { CATEGORIES, type PublicExhibit } from "@/domain/model";
import { museumHref, type MuseumRoute } from "@/domain/navigation";
import { Artifact } from "./Artifact";

interface Props {
  exhibits: PublicExhibit[];
  onNavigate: (
    event: MouseEvent<HTMLAnchorElement>,
    route: Exclude<MuseumRoute, { view: "unavailable" }>,
  ) => void;
}

export function Gallery({ exhibits, onNavigate }: Props) {
  const [category, setCategory] = useState("All possibilities");
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      exhibits.filter(
        (item) =>
          (category === "All possibilities" || item.category === category) &&
          `${item.title} ${item.subtitle} ${item.premise}`
            .toLowerCase()
            .includes(search.toLowerCase().trim()),
      ),
    [exhibits, category, search],
  );
  const first = exhibits[0];
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" /> EXHIBITION № 001{" "}
            <span className="eyebrow-slash">/</span> OPEN TO POSSIBILITY
          </div>
          <h1>
            For everything
            <br />
            that <em>almost</em>
            <br />
            happened.
          </h1>
          <p>
            A small museum of futures we never made.
            <br />
            Choose an object. Make a choice. See what follows.
          </p>
          <a className="button button-dark" href="#collection">
            Choose your first object <span>↗</span>
          </a>
          <div className="hero-footnote">
            <span>06 OBJECTS</span>
            <i /> <span>COUNTLESS WHAT-IFS</span>
          </div>
        </div>
        {first && (
          <a
            className="hero-art"
            href={museumHref({ view: "exhibit", exhibitId: first.id })}
            onClick={(event) =>
              onNavigate(event, { view: "exhibit", exhibitId: first.id })
            }
            aria-label={`Enter ${first.title}`}
          >
            <Artifact kind={first.artifact} color={first.color} large />
            <div className="hero-art-tag">
              <span className="tiny-label">OBJECT 01 / LITTLE RITUALS</span>
              <strong>{first.title}</strong>
              <span>
                What if you could borrow a rainy afternoon? <b>↗</b>
              </span>
            </div>
            <span className="fiction-stamp">
              AN EXHIBITION
              <br />
              OF FICTIONAL
              <br />
              POSSIBILITIES <i>✳</i>
            </span>
          </a>
        )}
      </section>
      <div className="manifesto-strip">
        <span>NOT QUITE INVENTED.</span>
        <span>NOT QUITE FORGOTTEN.</span>
        <span>
          STILL WORTH IMAGINING. <b>✳</b>
        </span>
      </div>
      <section id="collection" className="collection section-pad" tabIndex={-1}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE PERMANENT MAYBE</span>
            <h2>
              Objects from
              <br />
              another everyday.
            </h2>
          </div>
          <p>
            Ordinary things. One extraordinary turn.
            <br />
            Each object opens a different possibility.
          </p>
        </div>
        <div className="collection-controls">
          <div className="filters" role="group" aria-label="Filter by theme">
            {["All possibilities", ...CATEGORIES].map((item) => (
              <button
                key={item}
                className={category === item ? "filter active" : "filter"}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="search-field">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a possibility"
              aria-label="Search exhibits"
            />
          </label>
        </div>
        <div className="collection-grid">
          {filtered.map((exhibit) => (
            <a
              className="exhibit-card"
              key={exhibit.id}
              href={museumHref({ view: "exhibit", exhibitId: exhibit.id })}
              onClick={(event) =>
                onNavigate(event, { view: "exhibit", exhibitId: exhibit.id })
              }
            >
              <div className="card-art">
                <Artifact kind={exhibit.artifact} color={exhibit.color} />
                <span className="card-number">{exhibit.number}</span>
                <span className="card-arrow">↗</span>
              </div>
              <div className="card-meta">
                <span>{exhibit.category}</span>
                <span>{exhibit.year}</span>
              </div>
              <h3>{exhibit.title}</h3>
              <p>{exhibit.subtitle}</p>
            </a>
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <h3>No almosts found.</h3>
            <p>Try another word or theme.</p>
            <button
              className="text-button"
              onClick={() => {
                setSearch("");
                setCategory("All possibilities");
              }}
            >
              Show the whole collection ↗
            </button>
          </div>
        )}
        <p className="fiction-note">
          Every object, date, and backstory in this exhibition is fictional.
        </p>
      </section>
      <section className="atlas-promo section-pad">
        <div>
          <span className="eyebrow">ONE IDEA LEADS TO ANOTHER</span>
          <h2>
            Follow the
            <br />
            <em>what if.</em>
          </h2>
          <p>
            A shared umbrella becomes a listening bench.
            <br />A borrowed minute becomes a gentler day.
          </p>
          <a
            className="button button-outline"
            href={museumHref({ view: "atlas" })}
            onClick={(event) => onNavigate(event, { view: "atlas" })}
          >
            Open the possibility map <span>↗</span>
          </a>
        </div>
        <div className="mini-map" aria-hidden="true">
          <span>RAIN</span>
          <i />
          <span>TIME</span>
          <i />
          <span>CARE</span>
          <div className="map-word">
            almost
            <br />
            <em>anything.</em>
          </div>
        </div>
      </section>
    </>
  );
}
