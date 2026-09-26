import { changedContentFields, type ExhibitContent } from "@/domain/model";

const fields: { key: keyof ExhibitContent; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "subtitle", label: "Short description" },
  { key: "category", label: "Theme" },
  { key: "year", label: "Imagined date" },
  { key: "premise", label: "The imagined invention" },
  { key: "almost", label: "Why it stayed almost" },
  { key: "question", label: "The question" },
  { key: "color", label: "Object color" },
  { key: "artifact", label: "Object study" },
  { key: "branches", label: "Choices and consequences" },
];

function display(
  value: ExhibitContent[keyof ExhibitContent] | undefined,
): string {
  if (Array.isArray(value))
    return value.length
      ? value
          .map(
            (branch) =>
              `${branch.label} → ${branch.targetId}\n${branch.consequence}`,
          )
          .join("\n\n")
      : "The path ends here.";
  return value ?? "Not yet published";
}

export function DiffPreview({
  published,
  draft,
}: {
  published?: ExhibitContent;
  draft: ExhibitContent;
}) {
  const changedKeys = changedContentFields(published, draft);
  const changed = fields.filter(({ key }) => changedKeys.includes(key));
  if (!changed.length)
    return (
      <div className="review-empty">
        <span>✓</span>
        <h3>All caught up.</h3>
        <p>
          This draft matches the exhibition. Make an edit to start a new review.
        </p>
      </div>
    );
  return (
    <div className="diff-preview">
      <p className="muted">
        {changed.length} {changed.length === 1 ? "field" : "fields"} changed
        from the exhibition. Review the saved revision below.
      </p>
      {changed.map(({ key, label }) => (
        <section className="diff-field" key={key}>
          <h4>{label}</h4>
          <div className="diff-columns">
            <div className="diff-old">
              <span className="tiny-label">ON THE WALL</span>
              <p>{display(published?.[key])}</p>
            </div>
            <div className="diff-new">
              <span className="tiny-label">PROPOSED</span>
              <p>{display(draft[key])}</p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
