import type { PublicExhibit } from "./model";

export interface JourneyStep {
  exhibitId: string;
  branchId: string;
}
export interface JourneyResult {
  stops: PublicExhibit[];
  consequences: string[];
  invalidAt: number | null;
}

export function resolveJourney(
  exhibits: PublicExhibit[],
  startId: string,
  steps: JourneyStep[],
): JourneyResult {
  const byId = new Map(exhibits.map((exhibit) => [exhibit.id, exhibit]));
  const first = byId.get(startId);
  if (!first) return { stops: [], consequences: [], invalidAt: 0 };
  const stops = [first];
  const consequences: string[] = [];
  const seen = new Set([startId]);
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const current = stops.at(-1)!;
    const branch = current.branches.find((item) => item.id === step.branchId);
    const next = branch && byId.get(branch.targetId);
    if (
      step.exhibitId !== current.id ||
      !branch ||
      !next ||
      seen.has(next.id)
    ) {
      return { stops, consequences, invalidAt: index };
    }
    consequences.push(branch.consequence);
    stops.push(next);
    seen.add(next.id);
  }
  return { stops, consequences, invalidAt: null };
}
