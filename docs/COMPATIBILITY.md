# Compatibility and known limitations

| Area | Status for 0.1.0-alpha.1 |
| --- | --- |
| Windows 11 Pro 64-bit, running this x86 app | Local build, real-video and native-window checks passed |
| Other Windows editions/builds | Not independently validated |
| CPU architecture | Windows x86 (32-bit process) only; x64 release not provided yet |
| Microsoft C++ runtime | v14 x86 14.44.35229 or newer; latest official package recommended |
| Required local runtime | Jellyfin Media Player 1.12.0 Windows x86, Qt 5.15.2 x86 and its libmpv-2.dll |
| Jellyfin server | Existing development testing used 12.2.0; other versions not systematically validated |
| SRT / WebVTT | Parser and transcript tests |
| ASS / SSA | Format, styling, line-break, Unicode and transcript tests; formatting simplified |
| Bitmap / burned-in subtitles | Unsupported; no OCR |
| Native transcript window | Open, close, reopen, theme, loading handoff and saved geometry checked locally |
| Font size / delay persistence | Regression tests and full-restart check on the development installation |
| Installer / removal | Local isolated-directory tests; stock executable hash unchanged |
| Joystick / HDMI-CEC | Disabled in this alpha |
| Code signing | Unsigned; no signing certificate or trusted-publisher claim |

The window matches the main player's theme. The native title bar still follows Windows. Searching filters the text; it does not translate or download new subtitle tracks. The track dropdown can browse a different text track without changing the video's selected subtitle.

Source baseline: official Qt-based Media Player v1.12.0, commit 41ba4348addd46b806ba7bd1a0c92b457ae5ed7c. This fork is not based on current Desktop master. Avoid reporting this fork's problems to upstream as if they were official-player defects.
