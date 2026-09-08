# Runtime Core

This topic answers "how a request travels through the client, and which components can change state." The page grouping stays in sync with the English Runtime Core.

## Reading Order

1. [IPC Protocol](/spec/03-runtime/01-ipc-protocol)
2. [Agent Runtime](/spec/03-runtime/02-agent-runtime)
3. [Tools and Permissions](/spec/03-runtime/03-tools-and-permissions)
4. [Rust host core](/spec/03-runtime/05-host-core-rust)
5. [Host RPC Protocol](/spec/03-runtime/06-host-rpc-protocol)
6. [Provider and Model System](/spec/03-runtime/11-provider-model-system)

## Focus Boundaries

- The renderer accesses desktop capabilities only through preload IPC.
- The pi sidecar holds the agent loop and provider-facing model work.
- The Rust host exclusively owns SQLite and is responsible for processes, the file system, RPC, and error boundaries.
- All protocol or state changes should update the E2E scenarios in sync.
