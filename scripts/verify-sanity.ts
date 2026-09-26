import { mkdir, writeFile } from "node:fs/promises";
import { fingerprint, MuseumError, publicExhibits } from "../src/domain/model";
import { graphProblems } from "../src/domain/validation";
import { SanityMuseumRepository } from "../src/repositories/sanity";
import { loadLocalEnvironment, safeScriptFailure } from "./environment";

async function main() {
  loadLocalEnvironment();
  const repository = new SanityMuseumRepository();
  const [state, published] = await Promise.all([
    repository.readWorkspace(),
    repository.readPublic(),
  ]);
  const expected = publicExhibits(state);
  if (expected.length !== 6 || published.length !== 6)
    throw new MuseumError(
      "COUNT_MISMATCH",
      "The integration check expects the six museum exhibits.",
    );
  if (graphProblems(published).length)
    throw new MuseumError(
      "INVALID_GRAPH",
      "The connected public graph is invalid.",
    );
  for (const item of expected) {
    const actual = published.find((exhibit) => exhibit.id === item.id);
    if (
      !actual ||
      actual.revision !== item.revision ||
      fingerprint(actual) !== fingerprint(item)
    ) {
      throw new MuseumError(
        "PROJECTION_MISMATCH",
        "Workspace snapshots and public Sanity projections do not match.",
      );
    }
  }
  await mkdir("qa", { recursive: true });
  await writeFile(
    "qa/live-sanity-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        status: "READ_ONLY_INTEGRATION_PASSED",
        projectId: process.env.SANITY_PROJECT_ID,
        dataset: process.env.SANITY_DATASET,
        publicExhibitCount: published.length,
        graphValid: true,
        snapshotsMatch: true,
        externalWrites: 0,
        liveWorkflowTested: false,
        submissionReady: false,
      },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write(
    "READ_ONLY_INTEGRATION_PASSED: 6 exhibits, matching published snapshots, valid public branches. Live workflow and deployed browser checks remain required.\n",
  );
}

main().catch(safeScriptFailure);
