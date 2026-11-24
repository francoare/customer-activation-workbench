# Customer Activation Workbench

An onboarding portfolio for a company selling invoice approval software to finance teams. The buyer leads Customer Success and wants more customers to reach a usable workflow sooner. The onboarding manager uses the workbench to decide where to spend two intervention slots this week. The customer’s finance lead owns decisions and approvals on the customer side.

## Product decisions

The workbench replaces a shared checklist of completed activities. A customer reaches first value when its finance lead approves a representative invoice through the agreed workflow and the manager records evidence. Milestones, dependencies and verification have separate controls. An internal task can be completed while an external dependency stays open. Confirming first value also preserves open dependencies for review.

The decision rule adds **urgency** and **ability to move the next dependency**. Urgency is 3 from overdue through tomorrow, 2 for two or three days out, 1 for four to seven days and 0 thereafter. The most actionable open dependency contributes 4 for an internal blocker, 3 for joint validation, 1 for discovery and 0 for a customer-owned decision or no open dependency. Ties go to the earliest target, then account name. Verified accounts and existing selections are excluded from suggestions. Suggestions fill the remaining slots and the manager can pick any eligible account instead.

**Zeta and Alpha** both score 6. Zeta is due tomorrow and the manager can arrange a workflow validation with the customer. Alpha is due in three days and the implementation specialist can fix the sample mapping. **Beta** is due sooner than Alpha, but the approval policy is the customer’s decision. **Epsilon** is five days overdue with an unknown owner and next step. Prioritizing known levers can defer discovery on an older account. The manager can override the suggestions and assign a discovery action while the account owner remains unknown.

Saving an intervention commits a slot, with a next action, action owner, follow-up date and rationale. A saved intervention continues to count after activation to represent capacity already committed. The manager can remove it to free a slot. Saving a plan does not contact the customer or perform the work.

## Measurement

**Time to verified first value** is elapsed time from the accepted onboarding kickoff, recorded once when the customer and onboarding team begin the agreed onboarding, to the first time the representative approval evidence is accepted and recorded. The prototype uses date precision and a fixed demo day of November 24, 2026. Each activated account shows its elapsed days. Gamma began on November 12 and was verified on November 23, so its elapsed time is 11 days.

In production, capture both events with UTC timestamps and a stable account ID. Report the median elapsed time for verified accounts by kickoff cohort alongside the share verified by target date among accounts whose target has passed. Keep open accounts visible in the cohort denominator for the latter metric. Elapsed time among verified accounts alone omits those still waiting. A completed-task measure counts effort even when a customer still cannot approve an invoice. All six examples and their dates are synthetic.

## Run locally

From the repository root, run the static server with Python 3, then open [the local workbench](http://127.0.0.1:8765/).

```sh
python -m http.server 8765 --bind 127.0.0.1 --directory docs
```

Run the domain checks with Node.js 22 or later.

```sh
node --test
```

The app uses browser-native HTML, CSS and JavaScript ES modules with no install step or external services. `docs/model.js` contains the seeded accounts, decision rule, validation and state transitions. `docs/app.js` owns rendering and browser interactions. The fixed demo date makes urgency and metric examples reproducible. The structure also supports GitHub Pages with `main` and `/docs` as the branch and folder. [GitHub Pages publishing guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

Changes are written to the versioned key `customer-activation-workbench.v1` in `localStorage` before the UI confirms a save. State is scoped to the browser profile and site origin. The demo loads automatically on a fresh origin. Use **Reset demo** to restore the six original records in that browser.

## Evaluator walkthrough

| Step | Check |
| --- | --- |
| Open the app in a fresh browser session or reset the demo. | Six accounts, one verified, one overdue and unverified, and no committed interventions. Zeta and Alpha are suggested. |
| Open Alpha and Beta. In Beta, set the internal milestone status to **Completed**, then save. | Alpha shows an internal mapping blocker. Beta still shows the open customer-owned policy and remains **Blocked**. |
| Open Gamma. | **Activated** from the start, invoice reference `INV-GAMMA-104` visible, and no intervention needed. |
| Plan Alpha. Clear **Action owner** and save. Restore the specialist, explain what can move and save. Plan Zeta with a follow-up and a rationale. | The empty owner produces a visible validation message. Both valid saves receive confirmations and occupy both slots. Epsilon still shows its unknown account owner. An attempted third selection is rejected. |
| Open Alpha. In **Milestone & dependencies**, resolve the internal blocker. Open **First value** and submit with blank evidence. | The blocker is marked **Resolved**. Verification is rejected with an evidence message. |
| Enter `INV-ALPHA-DEMO-01 · finance lead approval recorded in agreed workflow`, keep the demo date and attest to the representative approval. | Alpha becomes **Activated** and the evidence and elapsed time are visible. The committed intervention remains in the week’s plan. |
| Reload and reopen Alpha. Search for `no-account-match`, then use **Clear filters**. | Evidence, the saved action and resolved blocker survive reload. The empty state is visible until filters are cleared. |

Chrome desktop was used for the workflow above, including opening details with Enter and closing them with Escape. Additional checks covered adding a dependency with an unknown owner, filtering activated accounts, and resetting and reloading the demo. The portfolio and account details were also checked in a 390 px browser frame. The domain tests cover the urgency thresholds and target-date tie, the preserved customer dependency, slot limits and release, validation and persistence.

## Limitations

The app simulates approvals and customer updates. Evidence is a text reference and an attestation. The demo does not independently validate an invoice or source record. The prototype has a fixed week and no production invoice engine, authentication, CRM, messaging or shared storage. Storage is last-write-wins between tabs and data can be cleared by the browser.

A production next step would be recording immutable kickoff and verification events and sourcing evidence from the invoice system. Feedback from onboarding managers would help calibrate the urgency and actionability bands, especially for unknown owners and overdue accounts. Screen readers, other browser engines, simultaneous writes and production integrations have not been verified.
