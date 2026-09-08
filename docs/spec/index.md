# Spec Map

The spec map organizes the complete technical library into eight topic domains. Every English spec provides a Chinese body at the same relative path; protocol fields, code identifiers, and paths remain in their original form, and each page links back to the English source of truth at the top.

## Eight Topic Domains

| Topic | Chinese entry point | What you will find here |
|---|---|---|
| Product | [Product and Scope](product/) | Positioning, delivery scope, operating modes, and non-goals |
| Architecture | [Architecture and Engineering](architecture/) | Process boundaries, tech stack, repository structure, and data ownership |
| Runtime | [Runtime Core](runtime/) | IPC, Agent, tools, Rust host, RPC, and models |
| Experience | [User Experience](ux/) | Information architecture, internationalization, design system, and interaction |
| Security | [Security](security/) | Permissions, paths, plugins, and process isolation |
| Delivery | [Delivery and Acceptance](delivery/) | Milestones, acceptance, E2E, changes, and releases |
| Plugins | [Plugin System](plugins/) | Package format, API, permissions, lifecycle, and developer experience |
| Decisions | [Decisions and Metadata](meta/) | ADRs, decision log, and open questions |

## Recommended Reading Order

1. [Quick Start](/guide/)
2. [Frozen Baseline](/spec/00-baseline)
3. [Product and Scope](/spec/01-product/README)
4. [Architecture and Engineering](/spec/02-architecture/README)
5. [Runtime Core](/spec/03-runtime/README)
6. [Plugin System](/spec/07-plugins/README)
7. [Delivery and Acceptance](/spec/06-delivery/README)

## How to Stay in Sync

The Chinese and English directories use the same eight topic domains, file paths, and reading order. When the technical body
changes, the same logical change must update the corresponding Chinese page, the related ADRs, and the E2E test plan. Translated
pages explicitly point to the English source of truth, avoiding two separate definitions of protocol fields or code identifiers.
