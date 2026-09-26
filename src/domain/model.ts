export const CATEGORIES = [
  "Little rituals",
  "Shared spaces",
  "Slower living",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type ArtifactKind =
  | "umbrella"
  | "clock"
  | "bench"
  | "lamp"
  | "radio"
  | "garden";

export interface Branch {
  id: string;
  label: string;
  consequence: string;
  targetId: string;
}

export interface ExhibitContent {
  title: string;
  subtitle: string;
  category: Category;
  year: string;
  premise: string;
  almost: string;
  question: string;
  color: string;
  artifact: ArtifactKind;
  branches: Branch[];
}

export interface Snapshot {
  revision: number;
  content: ExhibitContent;
}

export interface Exhibit {
  id: string;
  number: string;
  draft: Snapshot;
  published: Snapshot | null;
  review: { revision: number; requestedAt: string } | null;
  approval: {
    revision: number;
    contentFingerprint: string;
    approvedAt: string;
  } | null;
}

export interface AuditEntry {
  id: string;
  action: "edited" | "review-requested" | "approved" | "published";
  exhibitId: string;
  revision: number;
  timestamp: string;
  actor: "curator" | "reviewer";
  detail: string;
}

export interface MuseumState {
  schemaVersion: 1;
  version: number;
  exhibits: Exhibit[];
  audit: AuditEntry[];
}

export interface PublicExhibit extends ExhibitContent {
  id: string;
  number: string;
  revision: number;
}

export type MuseumCommand = {
  exhibitId: string;
  expectedVersion: number;
  expectedRevision: number;
} & (
  | { type: "edit"; content: ExhibitContent }
  | { type: "request-review" }
  | { type: "approve" }
  | { type: "publish" }
);

export class MuseumError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
  ) {
    super(message);
    this.name = "MuseumError";
  }
}

export function publicExhibits(state: MuseumState): PublicExhibit[] {
  return state.exhibits.flatMap((exhibit) =>
    exhibit.published
      ? [
          {
            ...exhibit.published.content,
            id: exhibit.id,
            number: exhibit.number,
            revision: exhibit.published.revision,
          },
        ]
      : [],
  );
}

function canonicalContent(content: ExhibitContent): ExhibitContent {
  return {
    title: content.title,
    subtitle: content.subtitle,
    category: content.category,
    year: content.year,
    premise: content.premise,
    almost: content.almost,
    question: content.question,
    color: content.color,
    artifact: content.artifact,
    branches: content.branches.map(({ id, label, consequence, targetId }) => ({
      id,
      label,
      consequence,
      targetId,
    })),
  };
}

// Exact canonical content string, intentionally not a probabilistic hash.
export function fingerprint(content: ExhibitContent): string {
  return JSON.stringify(canonicalContent(content));
}

export function changedContentFields(
  previous: ExhibitContent | undefined,
  next: ExhibitContent,
): (keyof ExhibitContent)[] {
  const before = previous && canonicalContent(previous);
  const after = canonicalContent(next);
  return (Object.keys(after) as (keyof ExhibitContent)[]).filter(
    (key) => JSON.stringify(before?.[key]) !== JSON.stringify(after[key]),
  );
}
