import type { PublicExhibit } from "@/domain/model";
import { Artifact } from "./Artifact";

export function Atlas({
  exhibits,
  onOpen,
  onBranch,
}: {
  exhibits: PublicExhibit[];
  onOpen: (id: string) => void;
  onBranch: (exhibitId: string, branchId: string) => void;
}) {
  return (
    <section className="atlas section-pad">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE POSSIBILITY MAP</span>
          <h1>
            Nothing imagined
            <br />
            happens <em>alone.</em>
          </h1>
        </div>
        <p>
          Follow a choice from one object to the next.
          <br />
          Every line is a different kind of everyday.
        </p>
      </div>
      <div className="atlas-legend">
        <span>
          <i /> An imagined object
        </span>
        <span>→ A possible consequence</span>
        <span>
          6 objects ·{" "}
          {exhibits.reduce((sum, exhibit) => sum + exhibit.branches.length, 0)}{" "}
          connections
        </span>
      </div>
      <div className="atlas-list">
        {exhibits.map((exhibit) => (
          <article className="atlas-row" key={exhibit.id}>
            <button className="atlas-object" onClick={() => onOpen(exhibit.id)}>
              <span className="atlas-number">{exhibit.number}</span>
              <div className="atlas-thumbnail">
                <Artifact kind={exhibit.artifact} color={exhibit.color} />
              </div>
              <span>
                <small>{exhibit.category}</small>
                <strong>{exhibit.title}</strong>
              </span>
            </button>
            <div className="atlas-branches">
              {exhibit.branches.length ? (
                exhibit.branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => onBranch(exhibit.id, branch.id)}
                    aria-label={`Explore ${branch.label} from ${exhibit.title}`}
                  >
                    <span className="atlas-line">⤷</span>
                    <span>
                      <small>{branch.label}</small>
                      <strong>
                        {exhibits.find((item) => item.id === branch.targetId)
                          ?.title ?? "Unavailable"}
                      </strong>
                    </span>
                    <b>↗</b>
                  </button>
                ))
              ) : (
                <div className="atlas-terminal">✳ A place to begin again.</div>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="fiction-note">
        A map of fictional possibilities. Choices describe imagined
        consequences, not predictions.
      </p>
    </section>
  );
}
