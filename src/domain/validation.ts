import {
  CATEGORIES,
  MuseumError,
  type ExhibitContent,
  type MuseumCommand,
  type PublicExhibit,
} from "./model";

const ARTIFACTS = ["umbrella", "clock", "bench", "lamp", "radio", "garden"];
const ID = /^[a-z][a-z0-9-]{1,60}$/;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MuseumError("INVALID_INPUT", "Expected a structured object.");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new MuseumError(
      "INVALID_INPUT",
      `${label} must contain 1–${max} characters.`,
    );
  }
  return value.trim();
}

export function parseContent(input: unknown): ExhibitContent {
  const value = object(input);
  if (!Array.isArray(value.branches) || value.branches.length > 3) {
    throw new MuseumError(
      "INVALID_INPUT",
      "An exhibit can have at most three branches.",
    );
  }
  const category = text(value.category, "Category", 40);
  const artifact = text(value.artifact, "Artifact", 20);
  const color = text(value.color, "Color", 7);
  if (
    !CATEGORIES.includes(category as never) ||
    !ARTIFACTS.includes(artifact) ||
    !/^#[0-9a-f]{6}$/i.test(color)
  ) {
    throw new MuseumError(
      "INVALID_INPUT",
      "Choose a valid category, artifact, and hex color.",
    );
  }
  const branches = value.branches.map((entry) => {
    const branch = object(entry);
    const id = text(branch.id, "Branch ID", 61);
    const targetId = text(branch.targetId, "Target ID", 61);
    if (!ID.test(id) || !ID.test(targetId))
      throw new MuseumError("INVALID_INPUT", "Branch identifiers are invalid.");
    return {
      id,
      targetId,
      label: text(branch.label, "Branch label", 100),
      consequence: text(branch.consequence, "Consequence", 500),
    };
  });
  if (new Set(branches.map((b) => b.id)).size !== branches.length) {
    throw new MuseumError(
      "DUPLICATE_BRANCH",
      "Branch IDs must be unique within an exhibit.",
    );
  }
  return {
    title: text(value.title, "Title", 80),
    subtitle: text(value.subtitle, "Subtitle", 150),
    category: category as ExhibitContent["category"],
    artifact: artifact as ExhibitContent["artifact"],
    color,
    year: text(value.year, "Imagined date", 30),
    premise: text(value.premise, "Premise", 1200),
    almost: text(value.almost, "Why it stayed almost", 1000),
    question: text(value.question, "Question", 150),
    branches,
  };
}

export function parseCommand(input: unknown): MuseumCommand {
  const value = object(input);
  const exhibitId = text(value.exhibitId, "Exhibit ID", 61);
  if (
    !ID.test(exhibitId) ||
    !Number.isSafeInteger(value.expectedVersion) ||
    (value.expectedVersion as number) < 1 ||
    !Number.isSafeInteger(value.expectedRevision) ||
    (value.expectedRevision as number) < 1
  ) {
    throw new MuseumError(
      "INVALID_INPUT",
      "A valid workspace and exhibit revision are required.",
    );
  }
  const base = {
    exhibitId,
    expectedVersion: value.expectedVersion as number,
    expectedRevision: value.expectedRevision as number,
  };
  if (value.type === "edit")
    return { ...base, type: "edit", content: parseContent(value.content) };
  if (
    value.type === "request-review" ||
    value.type === "approve" ||
    value.type === "publish"
  )
    return { ...base, type: value.type };
  throw new MuseumError("INVALID_INPUT", "Unknown workflow action.");
}

/** Validates the candidate *published* graph, not unrelated drafts. */
export function graphProblems(exhibits: PublicExhibit[]): string[] {
  const problems: string[] = [];
  const byId = new Map(exhibits.map((exhibit) => [exhibit.id, exhibit]));
  if (byId.size !== exhibits.length)
    problems.push("Exhibit IDs must be unique.");
  for (const exhibit of exhibits) {
    for (const branch of exhibit.branches) {
      if (!byId.has(branch.targetId))
        problems.push(
          `${exhibit.title}: “${branch.label}” points to an unpublished or missing exhibit (${branch.targetId}).`,
        );
    }
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  function walk(id: string, path: string[]) {
    if (active.has(id)) {
      problems.push(`Branch cycle: ${[...path, id].join(" → ")}.`);
      return;
    }
    if (visited.has(id)) return;
    active.add(id);
    for (const branch of byId.get(id)?.branches ?? [])
      if (byId.has(branch.targetId)) walk(branch.targetId, [...path, id]);
    active.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) walk(id, []);
  return [...new Set(problems)];
}
