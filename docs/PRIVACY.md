# Storage and privacy

The player connects to the Jellyfin server you enter. The transcript reuses that signed-in session and fetches only the selected text track through the Jellyfin API. Access tokens are sent in headers, not copied into transcript links. Subtitle text is inserted as text, not executed as HTML.

This fork adds no analytics or crash-report upload. Normal upstream server communication still applies. Do not paste unredacted logs, tokens or private server addresses into public issues.

Application binaries are installed under `%LOCALAPPDATA%\JellyfinSubtitleBrowserApp`. They reuse runtime files copied locally from the official player; stock files are not overwritten.

The native player configuration, logs and preferences use `%LOCALAPPDATA%\JellyfinSubtitleBrowser`. Qt's embedded browser may also create its profile/cache under `%LOCALAPPDATA%\Jellyfin Subtitle Browser` because of the application display name. Both are separate from stock Jellyfin Media Player. Signing out through the app and removing these folders after uninstalling removes the fork's saved state; retain them if you want to reinstall without losing preferences.

The initial loading check inspects tiny browser-frame captures in memory. It does not save or upload them. The published demo was made from a separate invented-dialogue test page, not from a user's media library.
