# Architecture and Engineering

This topic explains how the desktop client is split apart, and who owns each process and data boundary. The Chinese pages provide a synchronized walkthrough; the complete contracts are in the corresponding English specs.

## Reading Order

1. [System Architecture](/spec/02-architecture/01-architecture)
2. [Application Tech Stack](/spec/02-architecture/02-tech-stack)
3. [Repository Structure](/spec/02-architecture/03-repo-structure)
4. [Documentation Site](/spec/02-architecture/04-documentation-site)

## System Map

```text
Renderer UI → Electron orchestration → Rust host core
     ↓                  ↓                    ↓
 transcript       pi Node sidecar       SQLite + processes
```

The Renderer handles presentation, Electron coordinates desktop capabilities, the pi sidecar runs the agent loop, and the Rust host owns privileged processes, the file system, RPC, and the persistence boundary.
