# The Museum of Almost

An interactive exhibition of six **fictional** everyday inventions. Visitors follow choices through a network of possible futures. A custom curator room turns changes into explicit, revision-bound reviews before publishing them.

**Current status: live Sanity integration verified; contest submission NOT_READY.** The real project `xmyaojxc` and public `production` dataset contain the six fictional exhibits and their workspace. Actual server reads and a complete review/publication workflow passed on 2026-09-21. Source repository: [asdv3189/museum-of-almost](https://github.com/asdv3189/museum-of-almost). A deployed HTTPS demo, hosted judge access, final media, and the DEV entry remain pending.

## Run the local museum

Requirements: Node.js 24 (tested with 24.19.0) and pnpm 11.19.0, pinned in `package.json`. No account or environment file is needed for local mode.

```sh
pnpm install --frozen-lockfile
pnpm dev
# http://127.0.0.1:8792
```

For a production build:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

The server binds to loopback. The first data request creates `.data/museum.json` from the fictional seed. Confirmed edits persist across page reloads and server restarts. No browser account or external API is used in local mode. `pnpm-workspace.yaml` allows the esbuild install script needed by the TypeScript toolchain; other dependency scripts are not broadly approved.

## Try the whole experience

1. Open **The exhibition**, filter or search, then enter **The Rain Library**.
2. Choose **Give it to the neighborhood**, then follow another choice. The story and object change together. Use the path at the top or **Change the last choice** to explore an alternative.
3. Open **Possibility map** to inspect every choice and destination.
4. In **Curator room**, edit an exhibit's description and save a new revision. The public exhibition keeps the previous snapshot.
5. Open **Review changes**. Compare **On the wall** with **Proposed**. Send for review, approve the exact revision, then put it on the wall.
6. Edit the approved draft again: review and approval disappear. A saved self-reference or cycle shows why publication is blocked. The **Audit trail** records only confirmed transitions.

Curator and reviewer are simulated workflow roles in this prototype. They are not independently authenticated people, and the seed does not invent review events.

### Share and revisit an entry point

The exhibition (`?view=exhibition`), possibility map (`?view=map`), curator room (`?view=curator`), and individual objects (`?view=exhibit&exhibit=rain-library`) have URL entry points. Gallery and main-navigation links support native new-tab/copy-link actions; ordinary clicks update the current view without reloading. Refresh and browser Back/Forward restore the URL entry point. Curator access still requires the configured key, which is never put in a URL.

Following a connection from the map also includes its initial choice in the URL (`choice=<branch-id>`), so that entry choice and its consequence can be restored. Further choices made inside an object visit, gallery search, and filters remain local to that view. Refresh or returning through browser history starts again from the URL's object and optional initial choice; it does **not** restore the full downstream journey. Use the in-exhibition path or **Change the last choice** to revise that ongoing journey. Invalid addresses, unpublished objects, or removed choices show an unavailable-link message with a route back to the collection.

## Architecture and invariants

| Boundary | Responsibility |
| --- | --- |
| `src/components/` | Gallery, branching explorer, possibility map, curator room, diff preview, CSS object studies |
| `src/domain/` | Typed content, input bounds, immutable transitions, exact-content approval, graph checks, visitor path resolution |
| `src/repositories/local.ts` | Atomic JSON snapshots, cross-process write lock, workspace version comparison, bounded Windows rename retry |
| `src/repositories/sanity.ts` | GROQ reads, `_rev` optimistic concurrency, one transaction for workspace and public projection |
| `src/sanity/` | Native Sanity references, schema, reversible document mapping, GROQ projections |
| `src/app/api/` | Public-only content API and guarded curator gateway |
| `tests/` | Independent fixtures, workflow/graph/journey tests, temporary-file persistence races, mocked Sanity contracts |

- Every edit increments the exhibit revision and clears its review and approval.
- Approval stores the current revision and an exact canonical content fingerprint (the canonical string, not a collision-prone hash).
- Publish requires the unchanged approved revision, expected workspace version, and a valid complete candidate public graph.
- Missing targets, unpublished targets, and cycles block publication. Invalid unrelated drafts do not block an otherwise valid public graph.
- Workspace and published exhibit change atomically. An old browser session gets a conflict, not a last-write-wins overwrite.
- Visitor choices resolve only through the published snapshots. Changing an earlier choice discards its downstream path.
- Provider errors are sanitized. Uncertain write acknowledgement prompts a reload; the client does not automatically repeat mutations.

## Content model in Sanity

`almostWorkspace` (`almost.workspace`) owns the six draft/published snapshot pairs, reviews, approvals, monotonically increasing workspace version, and audit. Keeping these together gives one `_rev` lock over the whole graph. `almostExhibit` documents (`almost.exhibit-<id>`) are the public projections queried by the visitor API. A publication patches the workspace using `ifRevisionId` and replaces one projection in the **same transaction**.

Branch targets are native Sanity `reference` objects. Draft references are weak so a curator can save an incomplete idea; published references are strong. Application graph validation additionally rejects directed cycles. The schema exposes content, branches, snapshot revisions, review requests, approvals, and audit as structured fields, not opaque JSON.

The Studio schema is deliberately read-only: use the custom curator room for mutations. This is an editor affordance, not a security boundary against someone with a privileged API token. A direct authorized Sanity writer can bypass application rules. This prototype does not claim paid Sanity Workflows, App SDK integration, real-time collaboration, managed review identities, Content Releases, comments, or scheduled drafts.

## Verified Sanity integration

Actual integration evidence recorded on 2026-09-21:

| Check | Observed result |
| --- | --- |
| Remote reads | Six public projections match their workspace snapshots; the graph is valid |
| Live workflow | Eight checks passed, including stale request rejection, draft isolation, approval invalidation, cycle rejection, and publication visibility |
| End state | 14 confirmed transitions; workspace version 15; Rain Library revision 5; original exhibit content restored with all 14 audit events preserved |
| Access | An unauthenticated curator request was rejected; the visitor API returned published Sanity content |
| Connected browser | The actual local browser showed six exhibits, the Sanity content-source footer, and the restored original Rain Library subtitle |

The local evidence files are `qa/live-sanity-verification.json`, `qa/live-workflow-verification.json`, and `qa/connected-browser-verification.json`. They contain status and counts without credentials and are excluded from the public source archive. The read-only verifier's `liveWorkflowTested: false` describes that verifier's scope; the separate workflow record contains the actual mutation results. These checks used real Sanity documents through the locally running application. Connected curator transitions were verified through the server API; the full curator browser flow was separately tested in local-storage mode. These checks do not establish hosted HTTPS behavior, individual reviewer identity, Studio operation, or judge access.

## Configure Sanity for your own environment

The existing project is already imported and verified; **do not rerun its seed import**. The following setup documents how to configure a server or initialize another empty project you control. Account creation, key transfer, and external writes need appropriate authorization. No paid Sanity feature is required.

1. The verified project is `xmyaojxc`, with its automatically created public `production` dataset. Reuse that dataset for this entry. This implementation uses namespaced IDs, which require authenticated reads even in a public dataset. Use your own project ID when running a separate copy.
2. Copy `.env.example` to `.env.local`. Set the real project ID/dataset. Create a server-side read-only Viewer token and a separate minimally scoped content Editor write token; do not use an Administrator token. The Free plan may offer predefined roles rather than custom per-document scopes.
3. `SANITY_READ_TOKEN` is required even for a public dataset: namespaced IDs contain dots, and Sanity excludes those IDs from unauthenticated public reads. Tokens are never `NEXT_PUBLIC_*`, put in URLs, committed, logged, or sent to the browser.
4. Set `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` to matching non-secret values if using Studio. Run `pnpm exec sanity dev` to inspect the schema after the project exists. No Studio has been hosted or tested against a live project yet.
5. Preview import locally. It creates `.data/sanity-seed.ndjson` and makes **zero network calls**:

   ```sh
   pnpm sanity:seed:preview
   ```

6. Only when initializing an authorized **empty** project, set `SANITY_WRITE_ENABLED=true` and pass that project's matching ID and dataset. For reference, the command used for this entry was:

   ```sh
   pnpm exec tsx scripts/seed-sanity.ts --apply --project-id=xmyaojxc --dataset=production
   ```

   The script requires the matching project ID **and** dataset as explicit arguments, plus zero existing museum IDs. It uses one create transaction and refuses to overwrite existing content. The NDJSON can be inspected first; do not import it with a replace/overwrite flag.

7. Run the read-only live verifier:

   ```sh
   pnpm sanity:verify
   ```

   This compares six remote public projections with their remote workspace snapshots and checks the graph. It writes a small local result in `qa/live-sanity-verification.json` without tokens or content. It makes no external writes and can be rerun. It is **not** itself a live workflow test or proof of submission readiness.

8. Set `MUSEUM_STORAGE=sanity`. Set `MUSEUM_CURATOR_KEY` to a random secret of at least 32 characters. Restart the app. The public visitor API remains token-free from the browser's perspective; authenticated server reads fetch the content. Enter the curator key in the room (memory only for that visit).
9. On an authorized synthetic collection, verify edit → review → approval → publication, stale requests, edit-after-approval, invalid branch blocking, and read-after-publish. This entry passed those checks. The bespoke first-run live verifier is retained only with local evidence and excluded from the source archive. It was operated against the explicitly configured local server and is not a general reset or safe rerun tool. A new live test must confirm its server's actual target and plan recovery for partially completed mutations.
10. Before any public deployment, use HTTPS, review the curator access boundary, configure environment secrets, add appropriate origin/CORS settings if hosting Studio, and test desktop/mobile routes at the actual judge URL. The challenge accepts the real project ID **or** a public dataset URL; this entry provides project ID `xmyaojxc`. Exposing the protected workspace to anonymous dataset queries is not required.

Do not mark the entry ready until judge access, deployment, final screenshots, and required submission details are verified. The existing `SUBMISSION_DRAFT.md` contains explicit placeholders for the remaining items.

## Netlify deployment preparation — not deployed

`netlify.toml` sets `pnpm build`, Node.js 24, and the documented pnpm hoisting flag. `package.json` pins pnpm 11.19.0. Netlify's automatically selected OpenNext adapter supplies the Next.js server runtime; no static export or manually pinned adapter is configured. These settings follow the official [Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) and [dependency management](https://docs.netlify.com/build/configure-builds/manage-dependencies/) documentation. An actual Netlify build has not been run.

Connect only a clean app repository to an authorized Netlify Free account. Configure `MUSEUM_STORAGE=sanity`, the project ID/dataset, and server credentials through Netlify's environment variable settings. The required names are listed in `.env.example`; keep their actual values out of source and `netlify.toml`. Free provides environment variables to functions but does not provide a Functions-only scope. All-scopes variables still require the app's server-only boundary. Do not set `NODE_ENV=production` before dependency installation. [Function environment variables](https://docs.netlify.com/build/functions/environment-variables/)

For public curator testing, transfer the approved writer credential and a strong curator key only through the hosting service's secret settings. Use a controlled access arrangement for judges; never publish Sanity API tokens or the curator secret in the entry. Verify the actual HTTPS visitor routes, Origin/Host checks, curator workflow, and anonymous judge access after deployment. The local file repository is not a durable cloud datastore.

Netlify Free currently has a 300-credit monthly hard cap. At the cap, sites can pause; hosting availability through judging is not guaranteed. Confirm the current Free plan and remaining credits before publishing. This repository configuration creates no account, deployment, paid service, or spending. [Current credit plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)

## Failure recovery and limits

- A local write creates an exclusive `.data/write.lock` directory. Another writer gets a conflict. Readers keep seeing the complete old or new snapshot. Windows sharing violations trigger a short bounded retry of the rename while preserving the old file.
- If a process crashes leaving the lock, stop all museum servers, back up `.data/museum.json`, check that no writer remains, then remove **only the empty `.data/write.lock` directory**. Restart and reload. Do not discard the data file to clear a lock.
- Malformed or unsupported local data is preserved and causes a visible service error. To intentionally reset the demo, stop the server, move `.data/museum.json` to a backup, then restart; a fresh fictional collection initializes. This resets only the local prototype.
- The single workspace document serializes editors and keeps the full audit. It is appropriate for six exhibits, not an unbounded multi-tenant CMS. Growth needs document size limits, durable audit pagination, and a migration contract.
- Cloud curator access is a shared-secret prototype gate. There is no individual identity, role separation, rate limiter, or organizational approval system yet. Direct provider writers remain trusted.
- URLs preserve the view, entry object, and optional initial map choice. Subsequent in-view choices, search, and filters are not persisted; curator saves persist. No analytics, tracking, purchases, email, or external API calls are built into the visitor experience.

## Sources and attribution

- [Official Path Two brief and requirements](https://dev.to/challenges/sanity-2026-09-16)
- [Sanity client configuration and runtime requirements](https://www.sanity.io/docs/apis-and-sdks/js-client-getting-started)
- [Sanity transactions and optimistic locking](https://www.sanity.io/docs/content-lake/transactions)
- [Sanity IDs and anonymous access](https://www.sanity.io/docs/content-lake/ids)
- [Sanity document access rules](https://www.sanity.io/docs/content-lake/keeping-your-data-safe)
- [Next.js August 2026 security release](https://nextjs.org/blog/august-2026-security-release)

The exhibit names, descriptions, dates, outcomes, and fictional prototype anecdotes were authored for this app with Codex. All six object studies are original CSS geometry. No historical claim, real tester, stock image, copied template, or external generated image is represented by the exhibition. Dependencies are listed in `package.json` and locked in `pnpm-lock.yaml`.
