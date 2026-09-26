import { createClient, type SanityClient } from "@sanity/client";
import {
  MuseumError,
  publicExhibits,
  type MuseumCommand,
  type MuseumState,
  type PublicExhibit,
} from "../domain/model";
import { transition } from "../domain/workflow";
import { graphProblems, parseContent } from "../domain/validation";
import {
  decodeWorkspace,
  PUBLIC_EXHIBITS_QUERY,
  publishedDocument,
  WORKSPACE_ID,
  WORKSPACE_QUERY,
  workspaceDocument,
  type WorkspaceDocument,
} from "../sanity/documents";
import type { MuseumRepository } from "./contracts";

export function createSanityClient(token?: string): SanityClient {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET;
  if (
    !projectId ||
    !/^[a-z0-9]+$/.test(projectId) ||
    !dataset ||
    !/^[a-z0-9_-]+$/.test(dataset)
  ) {
    throw new MuseumError(
      "SANITY_NOT_CONFIGURED",
      "A real Sanity project ID and dataset are required. Local demo mode is still available.",
      503,
    );
  }
  return createClient({
    projectId,
    dataset,
    apiVersion: "2026-09-21",
    useCdn: false,
    token,
    perspective: "published",
    timeout: 15000,
    maxRetries: 0,
  });
}

export class SanityMuseumRepository implements MuseumRepository {
  readonly mode = "sanity" as const;
  constructor(
    private readonly reader = authenticatedReader(),
    private readonly writer?: SanityClient,
  ) {}

  async readPublic(): Promise<PublicExhibit[]> {
    const documents = await this.reader.fetch<PublicExhibit[]>(
      PUBLIC_EXHIBITS_QUERY,
    );
    const exhibits = documents.map((item) => ({
      ...parseContent({ ...item, branches: item.branches ?? [] }),
      id: item.id,
      number: item.number,
      revision: item.revision,
    }));
    if (!exhibits.length || graphProblems(exhibits).length)
      throw new MuseumError(
        "INVALID_SANITY_DATA",
        "The public Sanity collection is empty or has invalid branches.",
        503,
      );
    return exhibits;
  }

  private async readDocument(): Promise<WorkspaceDocument> {
    const document = await this.reader.fetch<WorkspaceDocument | null>(
      WORKSPACE_QUERY,
      { id: WORKSPACE_ID },
    );
    if (!document)
      throw new MuseumError(
        "SANITY_NOT_SEEDED",
        "No museum workspace exists in this dataset. See the configuration guide.",
        503,
      );
    return document;
  }

  async readWorkspace(): Promise<MuseumState> {
    return decodeWorkspace(await this.readDocument());
  }

  async execute(command: MuseumCommand): Promise<MuseumState> {
    if (
      process.env.SANITY_WRITE_ENABLED !== "true" ||
      !process.env.SANITY_WRITE_TOKEN
    ) {
      throw new MuseumError(
        "SANITY_WRITES_DISABLED",
        "Sanity writes are disabled. Enable them explicitly after testing the project.",
        403,
      );
    }
    const writer =
      this.writer ?? createSanityClient(process.env.SANITY_WRITE_TOKEN);
    const previous = await this.readDocument();
    const next = transition(decodeWorkspace(previous), command);
    const { _id, _type, ...fields } = workspaceDocument(next);
    let transaction = writer
      .transaction()
      .patch(_id, (patch) => patch.ifRevisionId(previous._rev).set(fields));
    if (command.type === "publish") {
      const published = publicExhibits(next).find(
        (exhibit) => exhibit.id === command.exhibitId,
      )!;
      transaction = transaction.createOrReplace(publishedDocument(published));
    }
    try {
      await transaction.commit({ visibility: "sync" });
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 409) {
        throw new MuseumError(
          "STALE_WORKSPACE",
          "Sanity rejected a concurrent change. Reload the workspace.",
          409,
        );
      }
      throw new MuseumError(
        "SANITY_WRITE_FAILED",
        "Sanity did not confirm this save. Reload before retrying; no success has been assumed.",
        503,
      );
    }
    return next;
  }
}

function authenticatedReader(): SanityClient {
  if (!process.env.SANITY_READ_TOKEN) {
    throw new MuseumError(
      "SANITY_READ_TOKEN_REQUIRED",
      "A server-side read token is required for the museum’s namespaced Sanity documents.",
      503,
    );
  }
  return createSanityClient(process.env.SANITY_READ_TOKEN);
}
