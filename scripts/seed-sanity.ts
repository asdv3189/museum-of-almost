import { mkdir, writeFile } from "node:fs/promises";
import { createSeed } from "../src/data/seed";
import { MuseumError, publicExhibits } from "../src/domain/model";
import { createSanityClient } from "../src/repositories/sanity";
import { publishedDocument, workspaceDocument } from "../src/sanity/documents";
import { loadLocalEnvironment, safeScriptFailure } from "./environment";

async function main() {
  loadLocalEnvironment();
  const state = createSeed();
  const documents = [
    workspaceDocument(state),
    ...publicExhibits(state).map(publishedDocument),
  ];
  await mkdir(".data", { recursive: true });
  await writeFile(
    ".data/sanity-seed.ndjson",
    documents.map((document) => JSON.stringify(document)).join("\n") + "\n",
    "utf8",
  );
  if (!process.argv.includes("--apply")) {
    process.stdout.write(
      "PREVIEW_ONLY: 7 fictional documents written to .data/sanity-seed.ndjson. No network request or Sanity write occurred.\n",
    );
    return;
  }
  const expectedProject = process.argv
    .find((argument) => argument.startsWith("--project-id="))
    ?.slice("--project-id=".length);
  const expectedDataset = process.argv
    .find((argument) => argument.startsWith("--dataset="))
    ?.slice("--dataset=".length);
  if (!expectedProject || expectedProject !== process.env.SANITY_PROJECT_ID) {
    throw new MuseumError(
      "PROJECT_CONFIRMATION_REQUIRED",
      "Pass --project-id=<your real configured project ID> before importing.",
    );
  }
  if (expectedDataset !== process.env.SANITY_DATASET || !expectedDataset) {
    throw new MuseumError(
      "DATASET_CONFIRMATION_REQUIRED",
      "Pass --dataset=<your configured dataset> to confirm the exact import destination.",
    );
  }
  if (
    process.env.SANITY_WRITE_ENABLED !== "true" ||
    !process.env.SANITY_WRITE_TOKEN
  ) {
    throw new MuseumError(
      "IMPORT_DISABLED",
      "Import requires explicit write enablement and a server write token.",
    );
  }
  const client = createSanityClient(process.env.SANITY_WRITE_TOKEN);
  const ids = documents.map((document) => document._id);
  const count = await client.fetch<number>("count(*[_id in $ids])", { ids });
  if (count !== 0)
    throw new MuseumError(
      "IMPORT_WOULD_OVERWRITE",
      "Museum documents already exist. Import refused; existing content was preserved.",
    );
  let transaction = client.transaction();
  for (const document of documents) {
    transaction = transaction.create<Record<string, unknown>>(document);
  }
  await transaction.commit({ visibility: "sync" });
  process.stdout.write(
    "IMPORTED: 7 fictional documents in one transaction. Run the read-only verifier next.\n",
  );
}

main().catch(safeScriptFailure);
