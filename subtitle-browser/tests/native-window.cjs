/* End-to-end smoke test against the private Qt build's temporary loopback devtools port.
   Uses invented media and subtitles; never reads the user's authentication. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const {targets,connect,waitFor,sleep}=require('./cdp.cjs');
(async () => {
    const mainTarget = (await targets()).find(target => target.type === 'page' && !target.url.includes('#jellyfin-subtitle-browser'));
    assert.ok(mainTarget, 'Main native WebEngine target required');
    const main = await connect(mainTarget);
    let popup;
    try {
        await main.send('Page.navigate', {url: 'data:text/html,' + encodeURIComponent('<!doctype html><html><head><title>Native subtitle window test</title></head><body style="background:#18232e;color:white;font:24px Segoe UI"><h1>Jellyfin native window test</h1><p>Invented dialogue only. Your server authentication is not read.</p><div class="videoOsdBottom"><div class="buttons"><button class="btnSubtitles">CC</button></div></div></body></html>')});
        await waitFor(() => main.evaluate('!!(window.jmpInfo && window.jmpInfo.subtitleBrowserWindow)'), 'Native capability');
        await main.evaluate(`(() => { const style=document.createElement('style');style.id='test-jellyfin-theme';style.textContent='.dialog{background:rgb(18,18,18);color:rgb(240,240,240)}.emby-input,.emby-select{background:rgb(30,30,30);color:rgb(240,240,240);border:1px solid rgb(90,90,90)}.raised{background:rgb(45,45,45);color:rgb(240,240,240)}.button-submit{background:rgb(0,164,220);color:white}';document.head.appendChild(style);})()`);
        await main.evaluate(`(() => {
            window.__testClock = 1500;
            window._mpvVideoPlayer = class {
                setCurrentSrc(el, options) { this._currentPlayOptions=options; this._subtitleTrackIndexToSetOnPlaying=2; return Promise.resolve(); }
                currentTime(ms) { if(ms != null) window.__testClock=ms; return window.__testClock; }
                seekable() { return true; } getSubtitleOffset() { return 0; } destroy() {}
            };
            window.fetch=async()=>({ok:true,text:async()=> '[Events]\\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\\\i1}Current test line\\nDialogue: 0,0:00:03.00,0:00:05.00,Default,,0,0,0,,Next test line'});
        })()`);
        await main.evaluate(fs.readFileSync(require.resolve('../subtitle-browser.js'), 'utf8'));
        await main.evaluate(`window.__testPlayer=new window._mpvVideoPlayer(); window.__testPlayer.setCurrentSrc(null,{item:{Id:'test-item'},url:'https://test.invalid/Videos/test-item/stream?api_key=fake-test-only',mediaSource:{Id:'test-source',MediaStreams:[{Type:'Subtitle',Index:2,Codec:'ass'}]}});`);
        await main.evaluate(`window.__nativeSubtitleReady=false;window.addEventListener('jmp-subtitle-content-ready',()=>{window.__nativeSubtitleReady=true;});`);
        await main.click('.jmp-sb-launch');
        assert.equal(await main.evaluate('document.querySelectorAll(".jmp-sb").length'), 0, 'Never create a transcript overlay in the player');
        assert.equal(await main.evaluate('document.querySelector(".btnSubtitles").nextElementSibling.classList.contains("jmp-sb-launch")'), true, 'Launcher follows CC in playback toolbar');
        const popupTarget = await waitFor(async () => (await targets()).find(target => target.id !== mainTarget.id && target.url.includes('#jellyfin-subtitle-browser')), 'Native popup target');
        popup = await connect(popupTarget);
        await waitFor(() => popup.evaluate('document.querySelectorAll(".cue").length === 2'), 'Detached transcript');
        await waitFor(() => main.evaluate('window.__nativeSubtitleReady === true'), 'Native loading screen handoff after browser paint');
        assert.equal(await popup.evaluate('document.querySelectorAll("header").length'), 0, 'Only the native Windows title bar is shown');
        const layout = await popup.evaluate(`(() => { const p=document.querySelector('.jmp-sb').getBoundingClientRect(), f=document.querySelector('.status').getBoundingClientRect(), h=getComputedStyle(document.querySelector('.tools')); return {left:p.left,top:p.top,right:p.right,bottom:p.bottom,width:innerWidth,height:innerHeight,footerBottom:f.bottom,padding:h.paddingLeft}; })()`);
        assert.equal(layout.left, 0); assert.equal(layout.top, 0);
        assert.ok(Math.abs(layout.right-layout.width)<2 && Math.abs(layout.bottom-layout.height)<2, 'Panel fits the native client area');
        assert.ok(layout.footerBottom <= layout.height, 'Status footer stays visible');
        assert.equal(layout.padding, '14px', 'Consistent control margin');
        assert.equal(await popup.evaluate('getComputedStyle(document.querySelector(".jmp-sb")).backgroundColor'), 'rgb(18, 18, 18)', 'Window inherits Jellyfin dark surface');
        await main.evaluate(`document.getElementById('test-jellyfin-theme').textContent += '.emby-select{background:white;color:white}';`);
        await sleep(1100);
        assert.equal(await popup.evaluate('getComputedStyle(document.querySelector("select")).backgroundColor'), 'rgb(30, 30, 30)', 'Track dropdown ignores white native select defaults');
        await main.evaluate(`document.getElementById('test-jellyfin-theme').textContent='.dialog{background:rgb(245,245,245);color:rgb(25,25,25)}.emby-input,.emby-select{background:transparent;color:rgb(25,25,25);border:1px solid rgb(120,120,120)}.raised{background:rgb(225,225,225);color:rgb(25,25,25)}.button-submit{background:rgb(80,60,180);color:white}';`);
        await waitFor(() => popup.evaluate('getComputedStyle(document.querySelector(".jmp-sb")).backgroundColor === "rgb(245, 245, 245)"'), 'Live Jellyfin light theme');
        assert.equal(await popup.evaluate('getComputedStyle(document.querySelector("input")).backgroundColor'), 'rgb(245, 245, 245)', 'Transparent themed inputs remain legible on light surface');
        assert.equal(await popup.evaluate('!!window.opener'), true, 'Popup retains its original player connection');
        await waitFor(() => popup.evaluate('document.querySelectorAll(".cue.active").length === 1'), 'Detached active cue');
        await popup.evaluate('document.querySelectorAll(".cue")[1].dispatchEvent(new MouseEvent("dblclick",{bubbles:true}))');
        assert.equal(await main.evaluate('window.__testClock'), 3000, 'Detached line seeks the original player');
        assert.equal(await popup.evaluate('[...document.querySelectorAll("button")].some(b=>b.textContent==="Dock")'), false, 'No docking control');
        await popup.evaluate('window.close()');
        await waitFor(() => main.evaluate('document.querySelector(".jmp-sb-launch").getAttribute("aria-pressed") === "false"'), 'Closed popup');
        await waitFor(async () => !(await targets()).some(target => target.id === popupTarget.id), 'Native window destroyed, not merely cleared');
        await main.click('.jmp-sb-launch');
        const reopenedTarget = await waitFor(async () => (await targets()).find(target => target.id !== mainTarget.id && target.id !== popupTarget.id && target.url.includes('#jellyfin-subtitle-browser')), 'Reopened popup');
        popup.close(); popup = await connect(reopenedTarget);
        await waitFor(() => popup.evaluate('document.querySelectorAll(".cue").length === 2'), 'Reopened transcript');
        const restoredSize=await popup.evaluate('({width:innerWidth,height:innerHeight})');
        assert.equal(restoredSize.width,layout.width,'Native window width persists after close');
        assert.equal(restoredSize.height,layout.height,'Native window height persists after close');
        await popup.evaluate('window.close()');
        await waitFor(() => main.evaluate('document.querySelector(".jmp-sb-launch").getAttribute("aria-pressed") === "false"'), 'Launcher after native window close');
        await main.evaluate(`(() => {
            window.__testPlayer.destroy();
            document.querySelector('.videoOsdBottom').style.display='none';
            const bar=document.createElement('div');bar.className='videoOsdBottom';bar.id='second-playback-toolbar';
            bar.innerHTML='<div class="buttons"><button class="btnSubtitles">CC</button></div>';document.body.appendChild(bar);
            window.__testPlayer=new window._mpvVideoPlayer();window.__testPlayer.setCurrentSrc(null,{item:{Id:'second-item'},url:'https://test.invalid/Videos/second-item/stream?api_key=fake-test-only',mediaSource:{Id:'second-source',MediaStreams:[{Type:'Subtitle',Index:2,Codec:'ass'}]}});
        })()`);
        await waitFor(() => main.evaluate('!!document.querySelector("#second-playback-toolbar .jmp-sb-launch")'), 'Launcher on subsequent playback');
        console.log('Native window test passed: toolbar beside CC, direct native opening, no player overlay, transcript, seeking, reopening, close.');
    } finally {
        if (popup) popup.close();
        main.close();
    }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
