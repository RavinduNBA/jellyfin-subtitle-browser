# Build from source

The Windows release uses the Qt-based Jellyfin Media Player v1.12.0 lineage. Install Visual Studio with Desktop development with C++ and CMake tools, Git, Python and Node.js.

Provide a Qt 5.15.2 x86 MSVC2019 SDK with qtwebengine and its supporting modules, and MPV development headers/import library matching the locally installed x86 libmpv runtime. The tested library is a development MPV build; loadfile layout is selected using its runtime API version.

```powershell
./subtitle-browser/Test.ps1
./release/Build-Release.ps1 -QtRoot C:\path\to\Qt\5.15.2\msvc2019 -MpvRoot C:\path\to\mpv -BuildDirectory C:\path\to\build
```

The MPV folder must contain include/mpv headers, libmpv-2.dll and an mpv.def exports file. Build-Release.ps1 creates the MSVC import library from that exports file. Qt is linked dynamically. Python's standard library bundles the extension during the native build; Node is only needed for tests.

Once the source is committed:

```powershell
./release/Create-Package.ps1 -BuildDirectory C:\path\to\build -OutputDirectory C:\path\to\release-output
```

This creates the installer ZIP, corresponding source ZIP and SHA-256 checksums. Downloaded SDKs, runtime DLLs, profiles, build outputs and demo captures must remain outside the source tree. The standard upstream build documentation is preserved in docs/UPSTREAM_README.md.

Optional native tests use a temporary loopback developer port and invented media; restart without the port afterward. The demo scripts require Pillow and optionally imageio-ffmpeg to encode MP4. They capture only an isolated fictional scene.
