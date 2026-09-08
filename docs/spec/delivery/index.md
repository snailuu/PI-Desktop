# Delivery and Acceptance

This topic connects "implementation complete" with "ready to deliver", covering milestones, acceptance criteria, E2E, change checklists, and the release runbook.

## Reading Order

1. [MVP Milestones](/spec/06-delivery/01-mvp-milestones)
2. [Acceptance Criteria](/spec/06-delivery/02-acceptance-criteria)
3. [AI Development Workflow](/spec/06-delivery/03-ai-development-workflow)
4. [E2E Test Plan](/spec/06-delivery/04-e2e-test-plan)
5. [Change Checklist](/spec/06-delivery/05-change-checklist)
6. [Release Runbook](/spec/06-delivery/06-release-runbook)

## Delivery Loop

```text
spec → implementation → targeted validation → E2E scenario → release record
```

Any behavior change visible to users or visible in the protocol must leave an executable scenario in the E2E test plan.
