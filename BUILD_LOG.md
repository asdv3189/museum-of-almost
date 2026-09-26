# Build log — The Museum of Almost

Build date: 2026-09-21. AI-native environment: Codex desktop. This is a curated process record, not a fabricated chat transcript. No human implementation or evaluation is claimed where work was performed by Codex or another coding agent.

## Brief translated into a concrete build

The official Path Two asks for an AI-native IDE build with Next.js or Astro and Sanity behind it. It values a working app, a thoughtful schema, creativity, and an honest build account. A real Sanity project ID or public dataset URL is required in the entry. The app's real project and workflow have now been exercised, but the entry remains **NOT_READY for submission** until its public source, deployment, judge access, and final entry are complete.

The task specification supplied to the implementation agent was: build “The Museum of Almost,” an original fictional exhibition of six unrealized everyday inventions, with visitor branching and a curator workbench that previews changes, reviews an exact revision, approves it, and publishes only the unchanged approved revision. It explicitly required honest local persistence and a real Sanity adapter without pretending a live account existed.

## Decisions and resulting code

1. **Content is a graph, not six blog posts.** A branch has its own stable ID, visitor choice, consequence, and destination. `journey.ts` resolves paths through public snapshots. `Atlas.tsx` shows each connection with its meaning; `Explorer.tsx` lets a visitor change an earlier choice.
2. **The small graph gets one concurrency boundary.** Drafts, review state, approvals, snapshots, and audit share the workspace document. Separate `almostExhibit` documents are public projections. The Sanity transaction patches the workspace with `_rev` compare-and-swap and publishes the one projection together. This avoids approving one revision and publishing another after a concurrent edit.
3. **Approval is tied to exact content.** `workflow.ts` stores a canonical content string and revision in the approval. Editing invalidates both review and approval. Publication revalidates the complete candidate public graph, including missing targets and cycles.
4. **Incomplete ideas remain editable.** Draft references are weak native Sanity references. Published references are strong, with application-level cycle validation. An invalid unrelated draft does not block another valid publication.
5. **Local and connected modes are distinct.** `LocalMuseumRepository` uses a real file and atomic replacement. `SanityMuseumRepository` implements authenticated server reads, GROQ projections, and revision-guarded transactions. Cloud writes require explicit configuration and a curator access gate. The footer reports which mode is active.
6. **Visual identity comes from the objects.** Six CSS studies depict an umbrella, clock, bench, lamp, radio, and garden. Muted object colors, editorial typography, short labels, and different gallery/detail/map/workbench layouts make the content visible. There is no image-generation or stock-media dependency.

## Failures and corrections actually observed

- **Serialization type collision.** The initial public document mapper spread embedded content after setting `_type`, overwriting `almostExhibit` with `exhibitContent`. Typecheck/test feedback exposed it. The mapper now spreads content first and assigns the document type last; an independent test verifies the resulting public document.
- **Windows reader/save race.** An independent temporary-directory test reproduced `EPERM` when an atomic rename overlapped a read of the destination file. The fix retries only transient rename failures, within a short bound and while holding the write lock. It preserves the existing file and does not replay domain commands or provider mutations. The full suite passed after the fix.
- **Namespaced Sanity ID access.** Independent review noticed that dotted IDs are not exposed to anonymous reads, even in a public dataset. The adapter now requires a server read-only token and fails with a clear configuration error. The later real connection uses the project's existing public `production` dataset with authenticated server reads. The initial mock checks and subsequent live checks are recorded separately.
- **Package install-script policy.** pnpm initially refused the unapproved esbuild postinstall. The project now explicitly allows only esbuild through its local `allowBuilds` setting. No global package-manager policy was relaxed.
- **Dense first-pass JSX.** Initial composition placed too many JSX nodes on single lines. All source modules were reformatted into multiline code; functionality remains split across components, domain, repositories, and server boundaries.
- **Actual browser origin failure.** The initial curator save failed on `127.0.0.1` because Next.js normalizes its request URL host to `localhost` while the browser Origin remains `127.0.0.1`. Authorization now compares Origin with the validated actual Host authority and protocol. Cross-origin, malformed-host, IPv6, default-port, and cloud-key regressions protect that correction.
- **Map choice was discarded.** The first possibility map opened the source object for every outgoing branch. Browser review exposed that mismatch. Map edges now enter the explorer with the chosen initial journey step, so the destination, source trail, and consequence appear together.
- **False-positive review diff.** Changing only a subtitle initially also flagged branches because server validation reordered JSON object keys. Diff comparison now uses canonical semantic fields. Independent tests distinguish property order from real destination, consequence, and branch-order changes.
- **Transitive dependency advisories.** An audit of the installed dependency graph found 11 known advisories. Scoped project overrides patched `js-yaml`, `smol-toml`, `uuid`, `esbuild`, and `adm-zip`. The repeated full audit reported no known vulnerabilities, and tests/typecheck/build were rerun with the updated lockfile. This is not a claim that the app is free of every possible vulnerability.

## Verification performed

An independent test agent authored fixture-local tests rather than importing the production seed as the expected answer. The suite covers approval invalidation and fingerprint tampering, stale revisions/workspaces, graph constraints, journey choices, file persistence and concurrency, Sanity native-reference mapping, mocked atomic transactions, provider conflicts, and lost acknowledgements.

- 116 automated tests passed after the final browser-driven corrections (`qa/automated-tests.txt`).
- TypeScript check and optimized Next.js production build passed.
- The production server was started on loopback port 8792. Root-agent browser review confirmed desktop rendering, a branch and undo, a 390×844 mobile view without horizontal overflow, search, and a full local edit → review → approval → publication with the public snapshot unchanged until publish. A final semantic-diff browser recheck is recorded separately by root.
- Actual Sanity import, authenticated reads, and live workflow mutations subsequently passed; details follow below. Studio operation, public cloud deployment, and actual judge access have **not** been verified.

Check `qa/` for separate independent-review and browser evidence. Review artifacts must describe observed results; this log does not claim another person's manual testing.

## Known limits and what remains

This prototype simulates curator and reviewer roles. It does not implement distinct authenticated people, Sanity App SDK, Sanity's paid managed workflow product, or real-time collaboration. Its custom workflow is application code operating on structured Sanity documents. The audit grows inside one workspace document; larger collections need a migration and pagination plan.

The root agent subsequently reported actual project creation after user login: `xmyaojxc`, default public `production` dataset. The project page showed a $0 Growth Trial with automatic downgrade to Free after 30 days and no card/payment; this app uses only the free feature set. The import command was adjusted to require both an explicit matching project ID and dataset, while continuing to refuse any overwrite.

## Actual Sanity connection and workflow

After the user completed login and the root agent handled the authorized credentials, the seven fictional documents were imported into `xmyaojxc` / `production`. The locally hosted app then ran with `MUSEUM_STORAGE=sanity` and explicitly enabled writes. No token value or credential-capture process is included in the source publication package.

`qa/live-workflow-verification.json`, recorded at 2026-09-21 11:07 UTC, reports eight passing checks: unauthenticated curator rejection, draft/public separation, stale-request rejection, unapproved-publication rejection, edit invalidation of approval, cycle rejection without a remote state change, approved publication visible through the public API, and restoration of the original content with audit preserved. Fourteen successful transitions left workspace version 15 and Rain Library revision 5. The 14 audit entries were retained. Curator and reviewer remained simulated roles; the evidence explicitly does not claim a real reviewer identity.

The following read-only check, recorded at 11:08 UTC in `qa/live-sanity-verification.json`, found six public projections, a valid graph, and exact correspondence with workspace snapshots. That verifier made zero writes. Its scope flag `liveWorkflowTested: false` refers only to the read verifier; the separate workflow result above establishes the actual mutation test.

At 11:10 UTC, actual browser inspection of the connected local app showed six exhibits, the “Content served from Sanity” footer, and the restored original Rain Library subtitle. `qa/connected-browser-verification.json` records that observation. The screenshot was displayed inline from the actual browser; no local screenshot file is claimed. Connected curator transitions were verified through the real server APIs; the earlier complete curator browser flow used local storage. Public hosting remains untested.

The non-secret `scripts/verify-live-workflow.mjs` is retained as local evidence of that one-time test and excluded from the public source archive. It requires workspace version 1 and changes remote synthetic content. Independent publication review found that its environment assertions do not prove the already-running server's target, and a failure can leave confirmed changes before restoration. The controlled run used the explicitly configured local Sanity server; the script is not presented as a general reusable live-test tool. No automatic reset, blind retry, or claim of rollback on failure was added.

## Hosting preparation and remaining work

Added a minimal `netlify.toml` with the build command, Node 24, and Netlify's documented pnpm hoisting option, plus `packageManager: pnpm@11.19.0` and a Node 24 engine declaration. The configuration leaves the OpenNext adapter on Netlify's automatic selection. The official Next.js and dependency documentation were checked on 2026-09-21. No Netlify account, secret transfer, build, or deployment was performed by this configuration change.

Before submission: create the user-owned public app repository, deploy with appropriate server secrets and access controls, inspect the actual HTTPS app, verify judge access, collect final screenshots, and complete the DEV template in English. The real project ID and live results are available; source/deployment/entry placeholders remain. Any further correction should be recorded here as actual work occurs.

## 2026-09-26: clearer invitation and addressable exhibition

A separate review found that the first screen did not clearly invite visitors to make a choice, and that views could not be linked or restored from a URL. The hero now says: "Choose an object. Make a choice. See what follows." Header and exhibit links use native anchors. Bounded query routes identify the exhibition, map, curator room, an exhibit, or an initial map choice; unknown or removed targets show an unavailable-link page. Further choices inside an exhibit and search/filter state remain temporary, as documented in README.

Independent code review caught a same-view home link retaining the collection fragment. Browser inspection then found that reloading a collection fragment before remote content loaded lost its scroll position. Both were corrected. The latter was reproduced before the fix and verified after rebuilding: the actual collection was at the top of the viewport and held keyboard focus after reload.

The final automated suite passed 127/127 tests, including 11 navigation regressions. Type checking and the optimized production build passed. Actual local browser checks against the connected Sanity dataset confirmed exhibit reload, map-choice reload, Back/Forward restoration and heading focus, the collection anchor, home fragment clearing, unknown-target recovery, and the updated first-screen invitation. A 390px mobile viewport showed no horizontal overflow and retained legible content. These are scoped automated and agent browser observations, not human audience testing or proof of hosted operation.

The user-owned public repository asdv3189/museum-of-almost was created for this source publication. Netlify Free was verified, but Git connection, server credential transfer, deployed HTTPS behavior, judge access, and contest submission remain separate unfinished steps. No remote museum content was changed during this navigation revision.
