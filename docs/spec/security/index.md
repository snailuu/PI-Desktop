# Security

The security spec describes which operations require authorization, which paths can be accessed, and how plugins and the host process are isolated.

## Key Entry Points

- [Security model](/spec/05-security/01-security)
- [Tools and permissions](/spec/03-runtime/03-tools-and-permissions)
- [Plugin security](/spec/07-plugins/04-plugin-security)
- [Host RPC and resource isolation](/spec/03-runtime/06-host-rpc-protocol)

## Maintenance Rules

Any change to permissions, processes, paths, plugin capabilities, or secret storage must be synced to the English spec, ADR, and E2E test plan.
