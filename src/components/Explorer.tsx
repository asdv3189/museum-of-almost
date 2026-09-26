"use client";

import { useState } from "react";
import type { PublicExhibit } from "@/domain/model";
import { resolveJourney, type JourneyStep } from "@/domain/journey";
import { Artifact } from "./Artifact";

export function Explorer({
  exhibits,
  startId,
  initialSteps = [],
  onBack,
}: {
  exhibits: PublicExhibit[];
  startId: string;
  initialSteps?: JourneyStep[];
  onBack: () => void;
}) {
  const [steps, setSteps] = useState<JourneyStep[]>(initialSteps);
  const journey = resolveJourney(exhibits, startId, steps);
  const current = journey.stops.at(-1);
  if (!current)
    return (
      <div className="empty-state">
        <h1>This possibility is unavailable.</h1>
        <button onClick={onBack}>Back to the exhibition</button>
      </div>
    );
  return (
    <section className="explorer section-pad">
      <div className="detail-top">
        <button className="text-button" onClick={onBack}>
          ← The collection
        </button>
        <span className="tiny-label">
          FICTIONAL OBJECT / {current.number} OF 06
        </span>
      </div>
      <div className="journey-trail" aria-label="Your possibility path">
        {journey.stops.map((stop, index) => (
          <span key={stop.id}>
            {index > 0 && <i>→</i>}
            <button
              aria-current={
                index === journey.stops.length - 1 ? "step" : undefined
              }
              onClick={() => setSteps(steps.slice(0, index))}
            >
              {stop.title}
            </button>
          </span>
        ))}
      </div>
      <div className="detail-grid" key={current.id}>
        <div className="detail-visual">
          <Artifact kind={current.artifact} color={current.color} large />
          <span className="detail-plaque">
            FIG. {current.number} <i /> AN OBJECT FROM ANOTHER EVERYDAY
          </span>
        </div>
        <div className="detail-copy">
          <span className="eyebrow">
            {current.category} <span className="eyebrow-slash">/</span>{" "}
            {current.year}
          </span>
          <h1>{current.title}</h1>
          <p className="detail-subtitle">{current.subtitle}</p>
          <p>{current.premise}</p>
          <div className="almost-note">
            <span className="tiny-label">WHY IT STAYED ALMOST</span>
            <p>{current.almost}</p>
          </div>
          <span className="fiction-note">
            A fictional invention. A real invitation to imagine.
          </span>
        </div>
      </div>
      {journey.consequences.length > 0 && (
        <div className="consequence" aria-live="polite">
          <span className="eyebrow">BECAUSE YOU CHOSE</span>
          <p>{journey.consequences.at(-1)}</p>
          <button
            className="text-button"
            onClick={() => setSteps(steps.slice(0, -1))}
          >
            ← Change the last choice
          </button>
        </div>
      )}
      <section className="branch-room">
        <span className="eyebrow">NOW, CHANGE THE STORY</span>
        <h2>{current.question}</h2>
        {current.branches.length ? (
          <div className="branch-options">
            {current.branches.map((branch, index) => (
              <button
                key={branch.id}
                onClick={() => {
                  setSteps([
                    ...steps,
                    { exhibitId: current.id, branchId: branch.id },
                  ]);
                  window.scrollTo({ top: 100, behavior: "smooth" });
                }}
              >
                <span className="branch-letter">
                  {String.fromCharCode(65 + index)}
                </span>
                <strong>{branch.label}</strong>
                <span className="branch-destination">
                  See what follows <b>↗</b>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="journey-end">
            <p>
              You followed a possibility all the way to a little more care.
              <br />
              There are other paths through this museum.
            </p>
            <button className="button button-dark" onClick={onBack}>
              Find another beginning <span>↗</span>
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
