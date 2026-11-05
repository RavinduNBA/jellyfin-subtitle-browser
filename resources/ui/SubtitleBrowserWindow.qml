import QtQuick 2.4
import QtWebEngine 1.7
import QtQuick.Window 2.15

Window
{
  id: subtitleWindow
  property var ownerWindow
  property var playerWebView
  property var settingsBridge
  property var systemBridge
  title: "Jellyfin - Subtitle Browser"
  width: 760
  height: 850
  minimumWidth: 440
  minimumHeight: 320
  visible: false
  property bool geometryReady: false
  property bool contentReady: false
  property bool checkingFrame: false
  property int paintedFrames: 0
  property color loadingBackground: "#101010"
  property color loadingForeground: "#eeeeee"
  color: "#121d27"
  transientParent: ownerWindow
  property alias targetView: subtitleView
  function saveGeometry()
  {
    if (!geometryReady) return
    if (visibility === Window.Windowed)
    {
      settingsBridge.setValue("subtitle_browser", "window_x", x)
      settingsBridge.setValue("subtitle_browser", "window_y", y)
      settingsBridge.setValue("subtitle_browser", "window_width", width)
      settingsBridge.setValue("subtitle_browser", "window_height", height)
      settingsBridge.setValue("subtitle_browser", "has_position", true)
    }
    if (visibility !== Window.Minimized)
      settingsBridge.setValue("subtitle_browser", "maximized", visibility === Window.Maximized)
  }
  Timer { id: saveWindowTimer; interval: 500; onTriggered: subtitleWindow.saveGeometry() }
  onXChanged: if (geometryReady) saveWindowTimer.restart()
  onYChanged: if (geometryReady) saveWindowTimer.restart()
  onWidthChanged: if (geometryReady) saveWindowTimer.restart()
  onHeightChanged: if (geometryReady) saveWindowTimer.restart()
  onVisibilityChanged: if (geometryReady) saveWindowTimer.restart()
  Component.onCompleted:
  {
    var settings = settingsBridge.allValues("subtitle_browser")
    var screens = Qt.application.screens
    var target = screens[0]
    var found = false
    if (settings.has_position)
      for (var i = 0; i < screens.length; i++)
        if (settings.window_x + 80 > screens[i].virtualX && settings.window_x < screens[i].virtualX + screens[i].width - 80 && settings.window_y + 40 > screens[i].virtualY && settings.window_y < screens[i].virtualY + screens[i].height - 40)
        { target = screens[i]; found = true; break }
    width = Math.max(minimumWidth, Math.min(Number(settings.window_width) || 760, target.width))
    height = Math.max(minimumHeight, Math.min(Number(settings.window_height) || 850, target.height - 50))
    x = found ? Math.max(target.virtualX, Math.min(settings.window_x, target.virtualX + target.width - width)) : target.virtualX + Math.round((target.width - width) / 2)
    y = found ? Math.max(target.virtualY + 30, Math.min(settings.window_y, target.virtualY + target.height - height)) : target.virtualY + 40
    geometryReady = true
    if (settings.maximized) showMaximized()
    else show()
  }
  onClosing:
  {
    saveWindowTimer.stop()
    saveGeometry()
    ownerWindow.subtitleBrowserPopup = null
    playerWebView.runJavaScript("window.dispatchEvent(new Event('jmp-subtitle-window-closed'))")
    destroy()
  }
  WebEngineView
  {
    id: subtitleView
    anchors.fill: parent
    profile: playerWebView.profile
    onWindowCloseRequested: subtitleWindow.close()
    onNavigationRequested:
    {
      if (request.url.toString() !== "about:blank#jellyfin-subtitle-browser" && request.url.toString() !== "about:blank")
        request.action = WebEngineNavigationRequest.IgnoreRequest
    }
  }
  // Draw immediately in Qt, before Chromium has created its first frame.
  Rectangle
  {
    anchors.fill: parent
    z: 10
    opacity: subtitleWindow.contentReady ? 0 : 1
    visible: opacity > 0
    Behavior on opacity { NumberAnimation { duration: 140 } }
    color: subtitleWindow.loadingBackground
    Column
    {
      anchors.centerIn: parent
      spacing: 14
      Text { anchors.horizontalCenter: parent.horizontalCenter; text: "Subtitle Browser"; color: subtitleWindow.loadingForeground; font.pixelSize: 21; font.weight: Font.DemiBold }
      Text { anchors.horizontalCenter: parent.horizontalCenter; text: "Loading subtitles\u2026"; color: subtitleWindow.loadingForeground; opacity: 0.7; font.pixelSize: 15 }
    }
  }
  Timer
  {
    interval: 100
    running: !subtitleWindow.contentReady && subtitleWindow.visible && subtitleWindow.visibility !== Window.Minimized
    repeat: true
    onTriggered: subtitleView.runJavaScript("(function(){var p=document.querySelector('.jmp-sb'); if(!p)return null;var s=getComputedStyle(p);return {ready:document.documentElement.getAttribute('data-jmp-subtitle-ready')==='true',background:s.backgroundColor,foreground:s.color};})()", function(state) {
      if (!state) return
      if (state.background && state.background !== "rgba(0, 0, 0, 0)") subtitleWindow.loadingBackground = state.background
      if (state.foreground) subtitleWindow.loadingForeground = state.foreground
      if (state.ready && !subtitleWindow.checkingFrame) {
        subtitleWindow.checkingFrame = true
        var grabbed = subtitleView.grabToImage(function(frame) {
          subtitleWindow.checkingFrame = false
          if (systemBridge.subtitleFrameHasContent(frame.image)) subtitleWindow.paintedFrames++
          else subtitleWindow.paintedFrames = 0
          if (subtitleWindow.paintedFrames >= 2) {
            subtitleWindow.contentReady = true
            playerWebView.runJavaScript("window.dispatchEvent(new Event('jmp-subtitle-content-ready'))")
          }
        }, Qt.size(320, 200))
        if (!grabbed) subtitleWindow.checkingFrame = false
      }
    })
  }
}
