import { parseContent } from "../domain/validation";
import {
  MuseumError,
  type ExhibitContent,
  type MuseumState,
  type PublicExhibit,
} from "../domain/model";

export const WORKSPACE_ID = "almost.workspace";
export const exhibitDocumentId = (id: string) => `almost.exhibit-${id}`;

export function encodeContent(content: ExhibitContent, weak: boolean) {
  return {
    ...content,
    _type: "exhibitContent",
    branches: content.branches.map(({ targetId, ...branch }) => ({
      ...branch,
      _type: "almostBranch",
      _key: branch.id,
      target: {
        _type: "reference",
        _ref: exhibitDocumentId(targetId),
        ...(weak ? { _weak: true } : {}),
      },
    })),
  };
}

function decodeContent(
  content: ReturnType<typeof encodeContent>,
): ExhibitContent {
  return parseContent({
    ...content,
    branches: content.branches.map(({ target, ...branch }) => ({
      ...branch,
      targetId: target._ref.replace(/^almost\.exhibit-/, ""),
    })),
  });
}

export function workspaceDocument(state: MuseumState) {
  return {
    _id: WORKSPACE_ID,
    _type: "almostWorkspace" as const,
    schemaVersion: state.schemaVersion,
    version: state.version,
    exhibits: state.exhibits.map((exhibit) => ({
      ...exhibit,
      _type: "exhibitWorkspace",
      _key: exhibit.id,
      draft: {
        ...exhibit.draft,
        _type: "exhibitSnapshot",
        content: encodeContent(exhibit.draft.content, true),
      },
      published: exhibit.published && {
        ...exhibit.published,
        _type: "exhibitSnapshot",
        content: encodeContent(exhibit.published.content, false),
      },
    })),
    audit: state.audit.map((event) => ({
      ...event,
      _type: "auditEvent",
      _key: event.id,
    })),
  };
}

export type WorkspaceDocument = ReturnType<typeof workspaceDocument> & {
  _rev: string;
};

export function decodeWorkspace(document: WorkspaceDocument): MuseumState {
  if (
    document.schemaVersion !== 1 ||
    !Number.isSafeInteger(document.version) ||
    !Array.isArray(document.exhibits) ||
    !Array.isArray(document.audit)
  ) {
    throw new MuseumError(
      "INVALID_SANITY_DATA",
      "The Sanity workspace has an unsupported structure.",
      503,
    );
  }
  return {
    schemaVersion: 1,
    version: document.version,
    exhibits: document.exhibits.map((exhibit) => ({
      id: exhibit.id,
      number: exhibit.number,
      draft: {
        revision: exhibit.draft.revision,
        content: decodeContent(exhibit.draft.content),
      },
      published: exhibit.published
        ? {
            revision: exhibit.published.revision,
            content: decodeContent(exhibit.published.content),
          }
        : null,
      review: exhibit.review,
      approval: exhibit.approval,
    })),
    audit: document.audit.map(
      ({ id, action, exhibitId, revision, timestamp, actor, detail }) => ({
        id,
        action,
        exhibitId,
        revision,
        timestamp,
        actor,
        detail,
      }),
    ),
  };
}

export function publishedDocument(exhibit: PublicExhibit) {
  const { id, number, revision, ...content } = exhibit;
  return {
    ...encodeContent(content, false),
    _id: exhibitDocumentId(id),
    _type: "almostExhibit" as const,
    exhibitId: id,
    number,
    revision,
    fiction: true,
  };
}

export const PUBLIC_EXHIBITS_QUERY = `*[_type == "almostExhibit" && fiction == true] | order(number asc) {
  "id": exhibitId, number, revision, title, subtitle, category, year, premise, almost, question, color, artifact,
  branches[] { id, label, consequence, "targetId": target->exhibitId }
}`;

export const WORKSPACE_QUERY = `*[_id == $id && _type == "almostWorkspace"][0]`;
