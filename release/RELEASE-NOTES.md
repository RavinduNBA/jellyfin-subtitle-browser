# 0.1.0-alpha.1 — first Windows x86 tester release

Unofficial, unsigned and primarily AI-developed. This is a legacy Qt Media Player fork, not an official Jellyfin release.

Adds a separate native subtitle-history window, SRT/WebVTT/ASS/SSA dialogue, search and replay, theme integration, persistent geometry/font size/delay, and a toolbar icon beside CC.

Requires the official Jellyfin Media Player 1.12.0 Windows x86 runtime first. The custom player installs side-by-side, with a separate executable, single-instance channel and profile. The ZIP does not redistribute Qt/MPV DLLs.

Assets: installer ZIP, exact corresponding source ZIP, SHA256SUMS.txt and a 24-second invented-dialogue demo. See GETTING-STARTED.md inside the package and the repository compatibility table.

Local checks: 17 JavaScript regressions; native video load/seek/pause; transcript open/reopen/theme/loading; side-by-side install/uninstall with stock executable unchanged. This is not broad hardware, security or server-compatibility certification. No OCR, x64 release, code signing or auto-update is provided.

Please use the fork's issue tracker for problems and redact private information.
