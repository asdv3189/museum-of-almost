import {
  fingerprint,
  MuseumError,
  publicExhibits,
  type MuseumCommand,
  type MuseumState,
} from "./model";
import { graphProblems, parseContent } from "./validation";

export function transition(
  previous: MuseumState,
  command: MuseumCommand,
  now = new Date().toISOString(),
): MuseumState {
  if (previous.version !== command.expectedVersion) {
    throw new MuseumError(
      "STALE_WORKSPACE",
      "The workspace changed in another session. Reload before trying again.",
      409,
    );
  }
  const state = structuredClone(previous);
  const exhibit = state.exhibits.find((item) => item.id === command.exhibitId);
  if (!exhibit) throw new MuseumError("NOT_FOUND", "Exhibit not found.", 404);
  if (exhibit.draft.revision !== command.expectedRevision) {
    throw new MuseumError(
      "STALE_REVISION",
      "This draft has changed. Reload the current revision.",
      409,
    );
  }
  let action: MuseumState["audit"][number]["action"];
  let detail: string;
  switch (command.type) {
    case "edit": {
      const content = parseContent(command.content);
      if (fingerprint(content) === fingerprint(exhibit.draft.content)) {
        throw new MuseumError(
          "NO_CHANGE",
          "There are no content changes to save.",
        );
      }
      exhibit.draft = { revision: exhibit.draft.revision + 1, content };
      exhibit.review = null;
      exhibit.approval = null;
      action = "edited";
      detail =
        "Saved a new draft. Any previous review and approval were invalidated.";
      break;
    }
    case "request-review":
      if (exhibit.review || exhibit.approval)
        throw new MuseumError(
          "ALREADY_REVIEWED",
          "This revision is already in review or approved.",
        );
      if (exhibit.published?.revision === exhibit.draft.revision)
        throw new MuseumError(
          "NO_UNPUBLISHED_CHANGES",
          "Edit the published exhibit before requesting a review.",
        );
      exhibit.review = { revision: exhibit.draft.revision, requestedAt: now };
      action = "review-requested";
      detail = "The current revision was sent for review.";
      break;
    case "approve":
      if (exhibit.review?.revision !== exhibit.draft.revision)
        throw new MuseumError(
          "REVIEW_REQUIRED",
          "Send this exact revision for review first.",
        );
      if (exhibit.approval)
        throw new MuseumError(
          "ALREADY_APPROVED",
          "This revision is already approved.",
        );
      exhibit.approval = {
        revision: exhibit.draft.revision,
        contentFingerprint: fingerprint(exhibit.draft.content),
        approvedAt: now,
      };
      action = "approved";
      detail = "Reviewer approved the exact content of this revision.";
      break;
    case "publish": {
      if (
        exhibit.approval?.revision !== exhibit.draft.revision ||
        exhibit.approval.contentFingerprint !==
          fingerprint(exhibit.draft.content)
      ) {
        throw new MuseumError(
          "APPROVAL_REQUIRED",
          "Publication requires approval of the unchanged current revision.",
        );
      }
      if (exhibit.published?.revision === exhibit.draft.revision)
        throw new MuseumError(
          "ALREADY_PUBLISHED",
          "This revision is already published.",
        );
      exhibit.published = structuredClone(exhibit.draft);
      const problems = graphProblems(publicExhibits(state));
      if (problems.length)
        throw new MuseumError("INVALID_GRAPH", problems.join(" "));
      action = "published";
      detail =
        "Published the approved revision after validating every public branch.";
      break;
    }
  }
  state.version += 1;
  state.audit.unshift({
    id: `event-${state.version}`,
    action,
    exhibitId: exhibit.id,
    revision: exhibit.draft.revision,
    timestamp: now,
    actor: command.type === "approve" ? "reviewer" : "curator",
    detail,
  });
  return state;
}
