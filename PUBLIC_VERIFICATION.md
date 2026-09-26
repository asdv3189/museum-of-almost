# Verification record

Observed on 2026-09-21. These are completed checks of this build, not an award or submission claim.

- Local automated tests: 116/116 passed; TypeScript checking and production build passed.
- Real Sanity project: xmyaojxc, production dataset. Seven fictional documents were imported with a create-only transaction.
- Remote read verification: all six public exhibits match workspace publication snapshots; their complete choice graph is valid.
- Connected server workflow: eight checks covered curator authentication, draft isolation, stale requests, unapproved publication, edit-after-approval, cycle rejection without mutation, publication visibility, and restoration.
- Fourteen successful remote transitions were recorded. Final workspace version 15, Rain Library revision 5. The original exhibit content was restored and the audit was retained.
- Actual connected browser: all six exhibits displayed, a Rain Library choice opened the Listening Bench, and the curator room required its access key.
- Curator and reviewer remain simulated application roles, not independently authenticated people. The controlled live verifier is excluded from this source archive because it is a one-run mutation tool tied to the dedicated test setup.
- Public hosting, anonymous judge access, and contest entry remain pending. Local browser/API checks do not prove a deployed service works.

The tests and source included here can be inspected and run locally. BUILD_LOG.md explains the failures, fixes, and remaining limitations. This authored record summarizes actual tool observations; it is not an independent certification.
