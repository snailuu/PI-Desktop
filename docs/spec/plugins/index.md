# Plugin System

The plugin system allows users to install and run extensions locally while maintaining explicit boundaries for package format, API, permissions, and lifecycle.

## Reading Order

1. [Plugin System](/spec/07-plugins/01-plugin-system)
2. [Plugin Development](/plugin-development)
3. [Manifest schema](/spec/07-plugins/02-plugin-manifest-schema)
4. [Plugin API](/spec/07-plugins/03-plugin-api)
5. [Plugin Security](/spec/07-plugins/04-plugin-security)
6. [Plugin Lifecycle](/spec/07-plugins/05-plugin-lifecycle)
7. [Developer Experience](/spec/07-plugins/10-plugin-devex)

## Current Boundaries

- Phase one targets local, user-installed plugins.
- The package format is `.piplug`, and the trust anchor is sha256 verification.
- The Marketplace protocol can be defined first, with the marketplace implementation following the roadmap.
