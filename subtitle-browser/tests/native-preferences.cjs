/* Run after a full player restart, on the real Jellyfin page. Authentication is not read. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {targets,connect,waitFor}=require('./cdp.cjs');
(async()=>{
    const target=(await targets()).find(t=>t.type==='page'&&!t.url.includes('#jellyfin-subtitle-browser'));
    const main=await connect(target);
    let popup;
    try {
        await waitFor(()=>main.evaluate('!!(window.api && window.api.settings && window.jmpInfo.settings.subtitle_browser)'), 'Restored native preferences');
        const saved=await main.evaluate('({font:Number(window.jmpInfo.settings.subtitle_browser.font_size),delay:Number(window.jmpInfo.settings.subtitle_browser.extra_delay)})');
        assert.ok(saved.font>=12&&saved.font<=32);
        await main.evaluate(`(() => {
            window.__preferenceTestRestore={player:window._mpvVideoPlayer,fetch:window.fetch};
            const toolbar=document.createElement('div');toolbar.id='preference-test-toolbar';toolbar.className='videoOsdBottom';toolbar.style.cssText='position:fixed;bottom:20px;left:20px;z-index:2147483646';toolbar.innerHTML='<div class="buttons"><button class="btnSubtitles">CC</button></div>';document.body.appendChild(toolbar);
            window._mpvVideoPlayer=class {setCurrentSrc(el,options){this._currentPlayOptions=options;this._subtitleTrackIndexToSetOnPlaying=2;return Promise.resolve();}currentTime(){return 1500;}seekable(){return true;}getSubtitleOffset(){return 0;}destroy(){}};
            window.fetch=(url,init)=>String(url).includes('preference-test.invalid')?Promise.resolve({ok:true,text:async()=> '1\\n00:00:01,000 --> 00:00:03,000\\nFont preference test'}):window.__preferenceTestRestore.fetch(url,init);
        })()`);
        await main.evaluate(fs.readFileSync(require.resolve('../subtitle-browser.js'),'utf8'));
        await main.evaluate(`window.__preferenceTestPlayer=new window._mpvVideoPlayer();window.__preferenceTestPlayer.setCurrentSrc(null,{item:{Id:'font-test'},url:'https://preference-test.invalid/Videos/font-test/stream?api_key=fake',mediaSource:{Id:'source',MediaStreams:[{Type:'Subtitle',Index:2,Codec:'srt'}]}});`);
        await main.click('#preference-test-toolbar .jmp-sb-launch');
        const popupTarget=await waitFor(async()=>(await targets()).find(t=>t.id!==target.id&&t.url.includes('#jellyfin-subtitle-browser')),'Preference test window');
        popup=await connect(popupTarget);
        await waitFor(()=>popup.evaluate('!!document.querySelector(".lines")'),'Restored font rendering');
        const actual=await popup.evaluate('({font:parseFloat(getComputedStyle(document.querySelector(".lines")).fontSize),delay:Number(document.querySelector(".delay").value)})');
        assert.equal(actual.font,saved.font,'Saved font size must be rendered after restart');
        assert.equal(actual.delay,saved.delay,'Saved subtitle delay must restore after restart');
        console.log(`Full-restart preference check passed: rendered font ${actual.font}px; saved delay restored.`);
    } finally {
        if(popup){await popup.evaluate('window.close()').catch(()=>{});popup.close();}
        await main.evaluate(`if(window.__preferenceTestPlayer)window.__preferenceTestPlayer.destroy();if(window.__preferenceTestRestore){window._mpvVideoPlayer=window.__preferenceTestRestore.player;window.fetch=window.__preferenceTestRestore.fetch;}const bar=document.getElementById('preference-test-toolbar');if(bar)bar.remove();`).catch(()=>{});
        main.close();
    }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
