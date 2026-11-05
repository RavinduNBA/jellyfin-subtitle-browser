/* Capture only an isolated invented-dialogue page in the release player. */
const fs=require('node:fs');
const path=require('node:path');
const {targets,connect,waitFor,sleep}=require('../subtitle-browser/tests/cdp.cjs');
const output=process.argv[2];
if(!output)throw Error('Output directory required');
fs.mkdirSync(output,{recursive:true});
(async()=>{
    const mainTarget=(await targets()).find(t=>t.type==='page'&&!t.url.includes('#jellyfin-subtitle-browser'));
    const main=await connect(mainTarget);let popup;
    try{
        const html=`<!doctype html><html><head><meta charset="utf-8"><title>Subtitle Browser demo</title><style>
        html,body{margin:0;height:100%;background:#111;color:#eee;font:26px Segoe UI,sans-serif}body{display:flex;flex-direction:column}
        header{padding:28px;background:#181818;font-weight:600}main{flex:1;background:linear-gradient(145deg,#18364a,#244c55,#151c30);display:flex;align-items:center;justify-content:center;text-align:center;padding:35px}h1{font-size:44px}p{font-size:24px;color:#b9d7df}.dialog{background:#111;color:#eee}.emby-input,.emby-select{background:#292929;color:#eee;border:1px solid #555}.raised{background:#333;color:#eee}.button-submit{background:#00a4dc;color:white}.videoOsdBottom{padding:22px;background:#181818}.buttons{display:flex;align-items:center;justify-content:flex-end}button{font:inherit;background:transparent;color:white;border:0;margin:8px}progress{width:100%;height:8px;accent-color:#00a4dc}#dialogue{font-size:30px;min-height:80px}</style></head><body><header>Jellyfin Subtitle Browser · Demo</header><main><div><h1>A conversation worth following</h1><p>Invented scene · no server or personal media</p><div id="dialogue"></div></div></main><div class="videoOsdBottom"><progress id="progress" max="24" value="0"></progress><div class="buttons"><span id="clock" style="margin-right:auto">00:00</span><button>♥</button><button class="btnSubtitles">CC</button><button>♫</button><button>◖</button></div></div></body></html>`;
        await main.send('Page.navigate',{url:'data:text/html,'+encodeURIComponent(html)});
        await main.send('Emulation.setDeviceMetricsOverride',{width:800,height:650,deviceScaleFactor:1,mobile:false});
        await waitFor(()=>main.evaluate('!!window.jmpInfo'),'Native demo page');
        const cues=['You can always look back.','Did you catch the last line?','Keep the conversation within reach.','The next line is already waiting.','Read at your own pace.','Go back and hear that again.','Search the whole conversation.','Then return to the current line.'];
        const srt=cues.map((text,i)=>`${i+1}\n00:00:${String(i*3).padStart(2,'0')},000 --> 00:00:${String(i*3+2).padStart(2,'0')},800\n${text}`).join('\n\n');
        await main.evaluate(`window.__demoMs=500;window._mpvVideoPlayer=class{setCurrentSrc(el,o){this._currentPlayOptions=o;this._subtitleTrackIndexToSetOnPlaying=2;return Promise.resolve();}currentTime(ms){if(ms!=null)window.__demoMs=ms;return window.__demoMs;}seekable(){return true;}getSubtitleOffset(){return 0;}destroy(){}};window.fetch=async()=>({ok:true,text:async()=>${JSON.stringify(srt)}});`);
        await main.evaluate(fs.readFileSync(path.resolve(__dirname,'../subtitle-browser/subtitle-browser.js'),'utf8'));
        await main.evaluate(`window.__demoPlayer=new window._mpvVideoPlayer();window.__demoPlayer.setCurrentSrc(null,{item:{Id:'demo'},url:'https://demo.invalid/Videos/demo/stream?api_key=demo-only',mediaSource:{Id:'demo-source',MediaStreams:[{Type:'Subtitle',Index:2,Codec:'srt',DisplayTitle:'English · Demo dialogue'}]}});`);
        await main.click('.jmp-sb-launch');
        const target=await waitFor(async()=>(await targets()).find(t=>t.id!==mainTarget.id&&t.url.includes('#jellyfin-subtitle-browser')),'Demo transcript');
        popup=await connect(target);
        await popup.send('Emulation.setDeviceMetricsOverride',{width:650,height:680,deviceScaleFactor:1,mobile:false});
        await waitFor(()=>popup.evaluate('document.querySelectorAll(".cue").length===8'),'Demo dialogue');
        await popup.evaluate('document.querySelector(".lines").style.fontSize="24px"');
        let position=500;
        const captions=[];
        for(let frame=0;frame<120;frame++){
            const seconds=frame/5;
            let caption='Keep previous, current and upcoming dialogue together';
            if(frame===45)await popup.evaluate('document.querySelector(".lines").dispatchEvent(new WheelEvent("wheel",{deltaY:-300}));document.querySelector(".lines").scrollTop=0');
            if(seconds>=9&&seconds<14)caption='Scroll back to reread a missed line';
            if(frame===70){await popup.evaluate('document.querySelectorAll(".cue")[2].dispatchEvent(new MouseEvent("dblclick",{bubbles:true}))');position=6000;}
            if(seconds>=14&&seconds<18)caption='Double-click dialogue to replay it';
            if(frame===90)await popup.evaluate('const search=document.querySelector("input[type=search]");search.value="conversation";search.dispatchEvent(new Event("input"))');
            if(seconds>=18&&seconds<21)caption='Search the complete subtitle transcript';
            if(frame===105)await popup.evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Back to current line").click()');
            if(seconds>=21)caption='Return to the current line · your font size is remembered';
            position+=180;
            await main.evaluate(`window.__demoMs=${position};document.getElementById('progress').value=${position/1000};document.getElementById('clock').textContent='00:'+String(Math.floor(${position}/1000)).padStart(2,'0');document.getElementById('dialogue').textContent=${JSON.stringify(cues[Math.min(7,Math.floor(position/3000))])};`);
            await sleep(170);
            for(const [name,client] of [['player',main],['transcript',popup]]){
                const screenshot=await client.send('Page.captureScreenshot',{format:'png',fromSurface:true});
                fs.writeFileSync(path.join(output,`${name}-${String(frame).padStart(3,'0')}.png`),Buffer.from(screenshot.data,'base64'));
            }
            captions.push(caption);
        }
        fs.writeFileSync(path.join(output,'captions.json'),JSON.stringify(captions));
        console.log('Captured 24-second demo from real UI using invented dialogue only.');
    }finally{if(popup){await popup.evaluate('window.close()').catch(()=>{});popup.close();}main.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
