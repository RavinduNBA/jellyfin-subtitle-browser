/* Exercise the actual Qt -> libmpv loadfile path with a local AVI. No mocked playback. */
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const {targets,connect,sleep}=require('./cdp.cjs');
(async () => {
    const pages = await targets();
    const target = pages.find(t => t.type === 'page' && !t.url.includes('#jellyfin-subtitle-browser'));
    assert.ok(target, 'Native client target required');
    const client = await connect(target);
    const evaluate = client.evaluate;
    try {
        for (let i = 0; i < 60; i++) {
            if (await evaluate('!!(window.api && window.api.player && window.api.player.load)')) break;
            await sleep(100);
        }
        const fileUrl = pathToFileURL((process.env.SUBTITLE_BROWSER_TEST_VIDEO || path.resolve(__dirname, '../../build/playback-test.avi'))).href;
        await evaluate(`new Promise(resolve => window.api.player.load(${JSON.stringify(fileUrl)}, {startMilliseconds:0,autoplay:true}, {type:'video',headers:{},metadata:{},media:{},frameRate:10}, '', '', resolve))`);
        let duration = 0, position = 0;
        for (let i = 0; i < 60; i++) {
            duration = await evaluate('new Promise(resolve => window.api.player.getDuration(resolve))');
            position = await evaluate('new Promise(resolve => window.api.player.getPosition(resolve))');
            // These legacy synchronous getters return seconds; seekTo accepts milliseconds.
            if (duration >= 7.9 && position > .15) break;
            await sleep(100);
        }
        assert.ok(duration >= 7.9, 'Real video must load and report its duration');
        assert.ok(position > .15, 'Real video playback clock must advance');
        await evaluate('window.api.player.seekTo(3000)');
        await sleep(250);
        position = await evaluate('new Promise(resolve => window.api.player.getPosition(resolve))');
        assert.ok(position >= 2.9 && position < 4.5, 'Native video seek must work');
        await evaluate('window.api.player.pause()');
        await sleep(150);
        const paused = await evaluate('new Promise(resolve => window.api.player.getPosition(resolve))');
        await sleep(250);
        const after = await evaluate('new Promise(resolve => window.api.player.getPosition(resolve))');
        assert.ok(Math.abs(after - paused) < .1, 'Native pause must hold the playback clock');
        console.log('Real native playback passed: AVI load, 8-second duration, advancing clock, seek, pause.');
    } finally {
        await evaluate('window.api.player.stop()').catch(() => {});
        client.close();
    }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
