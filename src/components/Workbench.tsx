"use client";

import { useEffect, useState } from "react";
import {
  CATEGORIES,
  fingerprint,
  publicExhibits,
  type Exhibit,
  type ExhibitContent,
  type MuseumCommand,
  type MuseumState,
} from "@/domain/model";
import { graphProblems } from "@/domain/validation";
import { Artifact } from "./Artifact";
import { DiffPreview } from "./DiffPreview";

function stage(exhibit: Exhibit): string {
  if (exhibit.published?.revision === exhibit.draft.revision)
    return "On the wall";
  if (exhibit.approval?.revision === exhibit.draft.revision) return "Approved";
  if (exhibit.review?.revision === exhibit.draft.revision) return "In review";
  return "Draft";
}

interface Props {
  mode: "local" | "sanity";
  onPublished: () => Promise<void>;
}

export function Workbench({ mode, onPublished }: Props) {
  const [state, setState] = useState<MuseumState | null>(null);
  const [selected, setSelected] = useState("rain-library");
  const [form, setForm] = useState<ExhibitContent | null>(null);
  const [tab, setTab] = useState<"edit" | "review" | "history">("edit");
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const exhibit =
    state?.exhibits.find((item) => item.id === selected) ?? state?.exhibits[0];

  async function load(key = accessKey) {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/workbench", {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setState(result.state);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The curator room could not be loaded.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (mode === "local") void load();
  }, [mode]); // Only local demo opens without a key.
  useEffect(() => {
    if (exhibit) setForm(structuredClone(exhibit.draft.content));
  }, [exhibit]);

  async function act(type: MuseumCommand["type"]) {
    if (!exhibit || !state || !form) return;
    setBusy(true);
    setError("");
    setNotice("");
    const command = {
      type,
      exhibitId: exhibit.id,
      expectedVersion: state.version,
      expectedRevision: exhibit.draft.revision,
      ...(type === "edit" ? { content: form } : {}),
    };
    try {
      const response = await fetch("/api/workbench", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessKey ? { Authorization: `Bearer ${accessKey}` } : {}),
        },
        body: JSON.stringify(command),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setState(result.state);
      setNotice(
        {
          edit: "A new draft is saved. Previous approval is cleared.",
          "request-review": "This exact revision is ready for review.",
          approve: "This exact revision is approved.",
          publish: "The approved revision is now on the wall.",
        }[type],
      );
      if (type === "request-review") setTab("review");
      if (type === "publish") await onPublished();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "That action could not be confirmed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function update<Key extends keyof ExhibitContent>(
    key: Key,
    value: ExhibitContent[Key],
  ) {
    setForm((current) => current && { ...current, [key]: value });
    setNotice("");
  }

  const unsaved =
    !!form &&
    !!exhibit &&
    fingerprint(form) !== fingerprint(exhibit.draft.content);
  const candidate = state && exhibit ? structuredClone(state) : null;
  if (candidate && exhibit)
    candidate.exhibits.find((item) => item.id === exhibit.id)!.published =
      structuredClone(exhibit.draft);
  const problems = candidate ? graphProblems(publicExhibits(candidate)) : [];
  const changed = exhibit?.published?.revision !== exhibit?.draft.revision;

  return (
    <section className="workbench section-pad">
      <div className="section-heading">
        <div>
          <span className="eyebrow">BEHIND THE EXHIBITION</span>
          <h1>The curator room.</h1>
        </div>
        <p>
          A little care before it goes out.
          <br />
          Edit. Review. Approve. Put it on the wall.
        </p>
      </div>
      <div className="workbench-mode">
        <span>
          <i className="status-dot" />
          {mode === "local"
            ? "Local demo · saved on this machine"
            : "Sanity Content Lake · connected repository"}
        </span>
        <span>Curator and reviewer roles are simulated in this prototype.</span>
      </div>
      {!state && mode === "sanity" && (
        <form
          className="access-form"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <label>
            Curator access key
            <input
              type="password"
              value={accessKey}
              autoComplete="off"
              onChange={(event) => setAccessKey(event.target.value)}
            />
          </label>
          <button className="button button-dark" disabled={busy}>
            Open workspace ↗
          </button>
          <p className="muted">
            The access key is kept in memory for this visit. Your Sanity token
            stays on the server.
          </p>
        </form>
      )}
      {error && (
        <div role="alert" className="message message-error">
          <span>{error}</span>
          <button onClick={() => void load()} disabled={busy}>
            Reload workspace
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="message message-success">
          {notice}
        </div>
      )}
      {!state && mode === "local" && !error && (
        <p className="loading-state">Opening the workbench…</p>
      )}
      {state && exhibit && form && (
        <div className="workbench-layout">
          <aside className="workbench-sidebar">
            <div className="sidebar-heading">
              <span className="tiny-label">COLLECTION</span>
              <span>{state.exhibits.length}</span>
            </div>
            {state.exhibits.map((item) => (
              <button
                key={item.id}
                className={
                  item.id === exhibit.id
                    ? "workbench-item selected"
                    : "workbench-item"
                }
                disabled={busy || (unsaved && item.id !== exhibit.id)}
                onClick={() => {
                  setSelected(item.id);
                  setNotice("");
                  setError("");
                }}
              >
                <span className="workbench-item-number">{item.number}</span>
                <span>
                  <strong>{item.draft.content.title}</strong>
                  <small>{stage(item)}</small>
                </span>
                <i style={{ background: item.draft.content.color }} />
              </button>
            ))}
            <div className="sidebar-note">
              <span>✳</span>
              <p>
                Edits create a new revision.
                <br />
                Approval belongs to exactly one.
              </p>
              <small>Workspace version {state.version}</small>
            </div>
          </aside>
          <div className="workbench-main">
            <div className="workbench-title">
              <div>
                <span className="tiny-label">
                  OBJECT {exhibit.number} / REVISION {exhibit.draft.revision}
                </span>
                <h2>{exhibit.draft.content.title}</h2>
              </div>
              <span
                className={`stage-badge ${stage(exhibit).toLowerCase().replaceAll(" ", "-")}`}
              >
                {stage(exhibit)}
              </span>
            </div>
            <div
              className="workbench-tabs"
              role="tablist"
              aria-label="Curator tools"
            >
              {(["edit", "review", "history"] as const).map((value) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                >
                  {value === "edit"
                    ? "01  Edit object"
                    : value === "review"
                      ? "02  Review changes"
                      : "03  Audit trail"}
                </button>
              ))}
            </div>
            {tab === "edit" && (
              <div
                className="editor-panel"
                role="tabpanel"
                aria-label="Edit object"
              >
                <div className="editor-intro">
                  <div className="editor-art">
                    <Artifact kind={form.artifact} color={form.color} />
                  </div>
                  <div>
                    <h3>Keep the possibility open.</h3>
                    <p>
                      Edit the story and the choices that connect it to the
                      collection. Visitors see the last published version.
                    </p>
                  </div>
                </div>
                <div className="editor-fields">
                  <label className="full-width">
                    Title
                    <input
                      value={form.title}
                      maxLength={80}
                      onChange={(event) => update("title", event.target.value)}
                    />
                  </label>
                  <label className="full-width">
                    Short description
                    <input
                      value={form.subtitle}
                      maxLength={150}
                      onChange={(event) =>
                        update("subtitle", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Theme
                    <select
                      value={form.category}
                      onChange={(event) =>
                        update(
                          "category",
                          event.target.value as ExhibitContent["category"],
                        )
                      }
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Imagined date
                    <input
                      value={form.year}
                      maxLength={30}
                      onChange={(event) => update("year", event.target.value)}
                    />
                  </label>
                  <label className="full-width">
                    The imagined invention
                    <textarea
                      rows={4}
                      maxLength={1200}
                      value={form.premise}
                      onChange={(event) =>
                        update("premise", event.target.value)
                      }
                    />
                  </label>
                  <label className="full-width">
                    Why it stayed almost
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={form.almost}
                      onChange={(event) => update("almost", event.target.value)}
                    />
                  </label>
                  <label className="full-width">
                    The branching question
                    <input
                      value={form.question}
                      maxLength={150}
                      onChange={(event) =>
                        update("question", event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="branch-editor-heading">
                  <div>
                    <h3>Where this idea goes next</h3>
                    <p>Every choice points to another exhibit.</p>
                  </div>
                  <button
                    className="small-button"
                    disabled={form.branches.length >= 3}
                    onClick={() =>
                      update("branches", [
                        ...form.branches,
                        {
                          id: `branch-${Date.now()}`,
                          label: "A new possibility",
                          consequence:
                            "Describe what changes in this imagined future.",
                          targetId: state.exhibits.find(
                            (item) => item.id !== exhibit.id,
                          )!.id,
                        },
                      ])
                    }
                  >
                    + Add a choice
                  </button>
                </div>
                <div className="branch-editors">
                  {form.branches.map((branch, index) => (
                    <fieldset key={branch.id}>
                      <legend>Choice {String.fromCharCode(65 + index)}</legend>
                      <label>
                        Visitor choice
                        <input
                          value={branch.label}
                          maxLength={100}
                          onChange={(event) =>
                            update(
                              "branches",
                              form.branches.map((item, i) =>
                                i === index
                                  ? { ...item, label: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Next exhibit
                        <select
                          value={branch.targetId}
                          onChange={(event) =>
                            update(
                              "branches",
                              form.branches.map((item, i) =>
                                i === index
                                  ? { ...item, targetId: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        >
                          {state.exhibits.map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.draft.content.title}
                              {item.id === exhibit.id
                                ? " (self — blocks publication)"
                                : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="full-width">
                        What changes
                        <textarea
                          rows={2}
                          value={branch.consequence}
                          maxLength={500}
                          onChange={(event) =>
                            update(
                              "branches",
                              form.branches.map((item, i) =>
                                i === index
                                  ? { ...item, consequence: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        className="remove-choice"
                        onClick={() =>
                          update(
                            "branches",
                            form.branches.filter((_, i) => i !== index),
                          )
                        }
                      >
                        Remove this choice
                      </button>
                    </fieldset>
                  ))}
                </div>
                {!form.branches.length && (
                  <p className="muted">
                    This is the end of a path. Visitors can start again from the
                    collection.
                  </p>
                )}
                <div className="editor-footer">
                  <span>
                    {unsaved
                      ? "You have unsaved changes."
                      : "All changes saved."}
                  </span>
                  <div>
                    {unsaved && (
                      <button
                        className="small-button"
                        disabled={busy}
                        onClick={() =>
                          setForm(structuredClone(exhibit.draft.content))
                        }
                      >
                        Discard changes
                      </button>
                    )}
                    <button
                      className="button button-dark"
                      disabled={busy || !unsaved}
                      onClick={() => void act("edit")}
                    >
                      {busy ? "Saving…" : "Save new revision"} <span>↗</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            {tab === "review" && (
              <div
                className="review-panel"
                role="tabpanel"
                aria-label="Review changes"
              >
                {unsaved && (
                  <div className="message message-warning">
                    Save or discard your unsaved edits before taking a review
                    action. This preview shows the saved draft.
                  </div>
                )}
                <DiffPreview
                  published={exhibit.published?.content}
                  draft={exhibit.draft.content}
                />
                <div className="publish-checks">
                  <h3>Before it goes on the wall</h3>
                  <p
                    className={
                      problems.length ? "check-failed" : "check-passed"
                    }
                  >
                    {problems.length
                      ? "× The public paths need attention"
                      : "✓ All public paths are connected and cycle-free"}
                  </p>
                  {problems.map((problem) => (
                    <p className="validation-error" key={problem}>
                      {problem}
                    </p>
                  ))}
                  <p className={exhibit.approval ? "check-passed" : "muted"}>
                    {exhibit.approval
                      ? `✓ Revision ${exhibit.approval.revision} has exact-content approval`
                      : "○ The current revision still needs approval"}
                  </p>
                </div>
                <div className="workflow-actions">
                  <div>
                    <span className="tiny-label">1 / CURATOR</span>
                    <button
                      className="button button-outline"
                      disabled={busy || unsaved || !changed || !!exhibit.review}
                      onClick={() => void act("request-review")}
                    >
                      Send for review
                    </button>
                  </div>
                  <div>
                    <span className="tiny-label">2 / DEMO REVIEWER</span>
                    <button
                      className="button button-outline"
                      disabled={
                        busy || unsaved || !exhibit.review || !!exhibit.approval
                      }
                      onClick={() => void act("approve")}
                    >
                      Approve revision {exhibit.draft.revision}
                    </button>
                  </div>
                  <div>
                    <span className="tiny-label">3 / CURATOR</span>
                    <button
                      className="button button-dark"
                      disabled={
                        busy ||
                        unsaved ||
                        !changed ||
                        !exhibit.approval ||
                        problems.length > 0
                      }
                      onClick={() => void act("publish")}
                    >
                      Put it on the wall ↗
                    </button>
                  </div>
                </div>
                <p className="review-footnote">
                  Any content edit clears approval. The server checks the
                  workspace revision, exact content, and complete public graph
                  again when publishing.
                </p>
              </div>
            )}
            {tab === "history" && (
              <div
                className="audit-panel"
                role="tabpanel"
                aria-label="Audit trail"
              >
                <span className="eyebrow">THE HISTORY OF A POSSIBILITY</span>
                <h3>Every confirmed step.</h3>
                {state.audit.filter((event) => event.exhibitId === exhibit.id)
                  .length ? (
                  <ol className="audit-list">
                    {state.audit
                      .filter((event) => event.exhibitId === exhibit.id)
                      .map((event) => (
                        <li key={event.id}>
                          <span className="audit-dot" />
                          <div>
                            <strong>{event.action.replaceAll("-", " ")}</strong>
                            <span>
                              Revision {event.revision} · {event.actor}
                            </span>
                            <p>{event.detail}</p>
                            <time dateTime={event.timestamp}>
                              {new Date(event.timestamp).toLocaleString()}
                            </time>
                          </div>
                        </li>
                      ))}
                  </ol>
                ) : (
                  <div className="review-empty">
                    <span>↗</span>
                    <p>
                      No workflow actions yet. The six starting objects are
                      fictional seed content, not a fabricated review history.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
