# Jellyfin Subtitle Browser — Windows x86 alpha

This is an **unsigned, unofficial, primarily AI-developed** experimental player based on Jellyfin Media Player 1.12.0. It is not released or endorsed by the Jellyfin project.

## Install

Install the latest [Microsoft Visual C++ v14 Redistributable **x86**](https://aka.ms/vc14/vc_redist.x86.exe) if needed. This alpha requires version 14.44.35229 or newer. Microsoft documents the matching-runtime requirement [here](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist). The installer checks this before changing anything.

1. Install the official **Jellyfin Media Player 1.12.0 Windows x86 (32-bit)** runtime first: [official release download](https://github.com/jellyfin/jellyfin-desktop/releases/download/v1.12.0/JellyfinMediaPlayer-1.12.0-windows-x86.exe). A 64-bit installation cannot provide this alpha's required runtime.
2. Download the alpha ZIP and compare its SHA-256 checksum with SHA256SUMS.txt on the release page.
3. Extract the **entire ZIP** into a folder, then double-click **Install.cmd**. It installs under your Windows account and creates a Start-menu shortcut. It does not replace the official player and needs no administrator permission for this step.
4. The new player opens using a separate profile. Connect to your Jellyfin server normally. The subtitle window itself shares that session; there is no second transcript login.
5. Play a video and select a text subtitle track. Click the window-and-lines icon immediately after **CC**, below the seeking bar. Move the transcript onto another monitor if desired.

Your browser or Windows may flag this unsigned alpha. Do not disable Windows security settings. If you do not trust the source or cannot verify the download, do not run it; build from source or wait for a signed release.

## Use

- Previous/current/next dialogue is shown together. Highlighting holds the last line through silence.
- Search dialogue; double-click a line to replay it.
- Scrolling pauses auto-follow. Back to current line resumes it.
- A+/A− adjust text size. Window geometry, font size and extra delay survive restart.
- The window adopts the current Jellyfin theme. Close it using the Windows title-bar X; playback continues.

## Update or remove

Quit this player and run the next release's Install.cmd. One previous application version is retained in the installation's `previous` folder. It is not a profile backup. The installer refuses another upgrade while that backup exists, so move or remove it after you are satisfied with the update.

Use `%LOCALAPPDATA%\JellyfinSubtitleBrowserApp\Uninstall.cmd` to remove this app and its shortcut. Your separate saved profile and stock player remain. To remove your saved login too, remove the profile directories only after uninstalling and deciding you no longer need them; see the repository's privacy/storage documentation.

## Limits

Windows x86 only; tested locally on Windows 11, not broadly across machines. Requires the legacy runtime specified above. Supports SRT, WebVTT, ASS and SSA text tracks the server can extract. No OCR for PGS/VobSub or burned-in subtitles. Live streams may not provide a complete transcript. Joystick/HDMI-CEC integrations are disabled in this alpha.

The package includes our built executable, client extension and notices. Qt/MPV runtime binaries are **not distributed in this ZIP**; the installer reuses a locally installed official runtime. Source for the custom executable and extension is provided with the same release/tag.
