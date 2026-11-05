const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Minimal DOM for testing the real extension's bridge and lifecycle, without a server account.
class Element {
    constructor(tag, document) {
        this.tagName = tag; this.ownerDocument = document; this.children = []; this.attributes = {};
        this.value = ''; this.style = {}; this.listeners = {}; this.clientHeight = 500; this.offsetTop = 100;
        this.classes = new Set();
        this.classList = {toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)};
    }
    set textContent(value) { this.content = value; this.children = []; }
    get textContent() { return (this.content || '') + this.children.map(child => child.textContent).join(''); }
    setAttribute(name, value) { this.attributes[name] = value; }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    get parentNode() { return this.parent; }
    get nextSibling() { return this.parent ? this.parent.children[this.parent.children.indexOf(this) + 1] || null : null; }
    insertBefore(child, next) { child.remove(); child.parent = this; const index = this.children.indexOf(next); this.children.splice(index < 0 ? this.children.length : index, 0, child); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    setPointerCapture() {}
}
function createDocument() {
    const document = {listeners: {}, createElement(tag) { return new Element(tag, this); },
        createElementNS(namespace, tag) { const el = new Element(tag, this); el.namespaceURI = namespace; return el; },
        querySelector(selector) { return all(this.body).find(el => el.className === (selector.includes('btnSubtitles') ? 'btnSubtitles' : 'buttons')); },
        querySelectorAll(selector) { return all(this.body).filter(el => el.className === (selector.includes('btnSubtitles') ? 'btnSubtitles' : 'buttons')); },
        getElementById(id) { return all(this.head).find(el => el.id === id); },
        addEventListener(name, fn) { this.listeners[name] = fn; }, removeEventListener(name) { delete this.listeners[name]; }};
    document.body = new Element('body', document); document.head = new Element('head', document);
    document.documentElement = new Element('html', document);
    return document;
}
function setup(fetch) {
    const document = createDocument();
    const toolbar = new Element('div', document); toolbar.className = 'buttons'; document.body.appendChild(toolbar);
    const cc = new Element('button', document); cc.className = 'btnSubtitles'; toolbar.appendChild(cc);
    class Player {
        constructor() { this.ms = 1500; this.offset = 0; }
        setCurrentSrc(el, options) { this._currentPlayOptions = options; this._subtitleTrackIndexToSetOnPlaying = 2; return Promise.resolve(); }
        destroy() { this._currentPlayOptions = null; }
        seekable() { return true; }
        currentTime(ms) { if (ms != null) this.ms = ms; return this.ms; }
        getSubtitleOffset() { return this.offset; }
    }
    let interval;
    const window = {document, jmpInfo:{subtitleBrowserWindow:true}, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, removeEventListener(name) { delete this.listeners[name]; }, _mpvVideoPlayer: Player, fetch, setInterval(fn) { interval = fn; return 1; }, clearInterval() {}, setTimeout, clearTimeout};
    window.open = () => {
        const popup = {document:createDocument(),closed:false,listeners:{},requestAnimationFrame(fn){fn();},addEventListener(name,fn){this.listeners[name]=fn;},close(){this.closed=true;if(this.listeners.beforeunload)this.listeners.beforeunload();}};
        window.popup=popup;document.popup=popup;return popup;
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../subtitle-browser.js'), 'utf8'), {window, URL, AbortController, console});
    return {window, document, player: new Player(), tick: () => interval()};
}
function all(el) { return [el, ...el.children.flatMap(all)]; }
function find(document, predicate) {
    const nodes = all(document.body);
    if(document.popup && !document.popup.closed) nodes.push(...all(document.popup.document.body));
    return nodes.find(predicate);
}
function options(id = 'item') {
    return {item: {Id: id}, url: `https://server.example/base/Videos/${id}/stream?api_key=existing-session`,
        mediaSource: {Id: 'source', MediaStreams: [{Index: 2, Type: 'Subtitle', Codec: 'srt'}, {Index: 3, Type: 'Subtitle', Codec: 'pgssub'}]}};
}
const srt = '1\n00:00:01,000 --> 00:00:02,000\nEarlier line\n\n2\n00:00:03,000 --> 00:00:04,000\nNext line';
const flush = () => new Promise(resolve => setImmediate(resolve));

test('loads authenticated transcript, highlights, seeks in milliseconds, and disposes', async () => {
    const requests = [];
    const app = setup(async (url, init) => { requests.push({url, init}); return {ok: true, text: async () => srt}; });
    app.player.setCurrentSrc(null, options());
    find(app.document, el => (el.className || '').includes('jmp-sb-launch')).onclick();
    await flush();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].init.headers['X-Emby-Token'], 'existing-session');
    assert.equal(requests[0].init.redirect, 'error');
    assert.equal(requests[0].url, 'https://server.example/base/Videos/item/source/Subtitles/2/Stream.srt');
    const rows = all(app.window.popup.document.body).filter(el => el.className === 'cue');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].classes.has('active'), true);
    app.player.ms = 2500; app.tick();
    assert.equal(rows[0].classes.has('active'), true, 'Keep previous dialogue highlighted in the gap');
    app.player.ms = 3000; app.tick();
    assert.equal(rows[0].classes.has('active'), false);
    assert.equal(rows[1].classes.has('active'), true, 'Switch when the next line starts');
    rows[1].ondblclick();
    assert.equal(app.player.ms, 3000);
    app.player.offset = 1.5;
    rows[1].ondblclick();
    assert.equal(app.player.ms, 4500);
    app.player.destroy();
    assert.equal(find(app.document, el => (el.className || '').includes('jmp-sb-launch')), undefined);
});

test('bitmap track switch clears previous lines without requesting OCR', async () => {
    let requests = 0;
    const app = setup(async () => { requests++; return {ok: true, text: async () => srt}; });
    app.player.setCurrentSrc(null, options());
    find(app.document, el => (el.className || '').includes('jmp-sb-launch')).onclick();
    await flush();
    app.player._subtitleTrackIndexToSetOnPlaying = 3; app.tick();
    assert.equal(requests, 1);
    assert.equal(all(app.window.popup.document.body).filter(el => el.className === 'cue').length, 0);
    assert.match(find(app.document, el => el.className === 'status').textContent, /Image-based/);
    app.player.destroy();
});

test('ASS track requests original ASS and loads its dialogue', async () => {
    let requested;
    const app = setup(async url => { requested = url; return {ok:true,text:async()=> '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\i1}ASS dialogue\\NSecond line'}; });
    const item = options(); item.mediaSource.MediaStreams[0].Codec = 'ass';
    app.player.setCurrentSrc(null,item);
    find(app.document,el=>(el.className||'').includes('jmp-sb-launch')).onclick(); await flush();
    assert.ok(requested.endsWith('/Stream.ass'));
    assert.match(find(app.document,el=>el.className==='lines').textContent,/ASS dialogue\nSecond line/);
    app.player.destroy();
});

test('episode change cancels stale response and stale rows cannot seek the new video', async () => {
    const pending = [];
    const app = setup((url, init) => new Promise(resolve => pending.push({url, init, resolve})));
    app.player.setCurrentSrc(null, options('first'));
    find(app.document, el => (el.className || '').includes('jmp-sb-launch')).onclick();
    pending[0].resolve({ok: true, text: async () => srt}); await flush();
    const oldRow = find(app.document, el => el.className === 'cue');
    app.player.setCurrentSrc(null, options('second'));
    assert.equal(pending[0].init.signal.aborted, true);
    app.player.ms = 100;
    oldRow.ondblclick(); assert.equal(app.player.ms, 100);
    pending[1].resolve({ok: true, text: async () => srt.replace('Earlier', 'Second episode')}); await flush();
    assert.match(find(app.document, el => el.className === 'lines').textContent, /Second episode/);
    app.player.destroy();
});

test('late response cannot reopen a closed transcript', async () => {
    let resolve;
    const app = setup(() => new Promise(done => { resolve = done; }));
    app.player.setCurrentSrc(null, options());
    const launch = find(app.document, el => (el.className || '').includes('jmp-sb-launch'));
    launch.onclick(); launch.onclick();
    resolve({ok: true, text: async () => srt}); await flush();
    assert.equal(find(app.document, el => el.className === 'jmp-sb'), undefined);
    app.player.destroy();
});

test('opens only a native window and closes it without creating a player overlay', async () => {
    const app=setup(async()=>({ok:true,text:async()=>srt}));
    app.player.setCurrentSrc(null,options());
    const launch=find(app.document,el=>(el.className||'').includes('jmp-sb-launch'));
    launch.onclick();await flush();
    assert.equal(all(app.document.body).some(el=>el.className==='jmp-sb'),false);
    assert.equal(all(app.window.popup.document.body).some(el=>el.tagName==='header'),false);
    const first=app.window.popup;
    launch.onclick();assert.equal(first.closed,true);
    launch.onclick();await flush();assert.notEqual(app.window.popup,first);
    app.player.destroy();assert.equal(app.window.popup.closed,true);
});
test('launcher follows replacement playback toolbars and returns after player destruction', async () => {
    const app = setup(async()=>({ok:true,text:async()=>srt}));
    app.player.setCurrentSrc(null,options('first'));
    const first = app.document.querySelector('.videoOsdBottom .btnSubtitles');
    first.getClientRects = () => [];
    const toolbar = new Element('div',app.document);toolbar.className='buttons';app.document.body.appendChild(toolbar);
    const cc = new Element('button',app.document);cc.className='btnSubtitles';cc.getClientRects=()=>[{}];toolbar.appendChild(cc);
    app.player.setCurrentSrc(null,options('second'));app.tick();
    let launcher = find(app.document,el=>(el.className||'').includes('jmp-sb-launch'));
    assert.equal(launcher.parentNode,toolbar);
    assert.equal(cc.nextSibling,launcher);
    app.player.destroy();
    const nextPlayer = new app.window._mpvVideoPlayer();nextPlayer.setCurrentSrc(null,options('third'));
    launcher = find(app.document,el=>(el.className||'').includes('jmp-sb-launch'));
    assert.equal(launcher.parentNode,toolbar);assert.equal(launcher.hidden,false);
    nextPlayer.destroy();
});

test('font size and extra delay restore from native settings and persist changes across players', async () => {
    const app=setup(async()=>({ok:true,text:async()=>srt}));
    const saved={font_size:20,extra_delay:1.25};
    app.window.jmpInfo={subtitleBrowserWindow:true,settings:{subtitle_browser:saved}};
    app.window.api={settings:{setValue(section,key,value){assert.equal(section,'subtitle_browser');saved[key]=value;}}};
    app.player.setCurrentSrc(null,options());
    find(app.document,el=>(el.className||'').includes('jmp-sb-launch')).onclick();await flush();
    assert.equal(find(app.document,el=>el.className==='lines').style.fontSize,'20px');
    find(app.document,el=>el.tagName==='button' && el.textContent==='A+').onclick();
    const delay=find(app.document,el=>el.className==='delay');assert.equal(delay.value,'1.25');delay.value='2.5';delay.onchange();
    assert.equal(saved.font_size,22);assert.equal(saved.extra_delay,2.5);
    app.player.destroy();
    const next=new app.window._mpvVideoPlayer();next.setCurrentSrc(null,options('next'));
    find(app.document,el=>(el.className||'').includes('jmp-sb-launch')).onclick();await flush();
    assert.equal(find(app.document,el=>el.className==='lines').style.fontSize,'22px');
    assert.equal(find(app.document,el=>el.className==='delay').value,'2.5');next.destroy();
});

test('fresh client restores non-enumerable NativeShell preference getters', async () => {
    const app=setup(async()=>({ok:true,text:async()=>srt}));
    const nativePreferences={};
    Object.defineProperty(nativePreferences,'font_size',{get:()=>28});
    Object.defineProperty(nativePreferences,'extra_delay',{get:()=>1.5});
    assert.equal(Object.keys(nativePreferences).length,0);
    app.window.jmpInfo={subtitleBrowserWindow:true,settings:{subtitle_browser:nativePreferences}};
    app.player.setCurrentSrc(null,options());
    find(app.document,el=>(el.className||'').includes('jmp-sb-launch')).onclick();await flush();
    assert.equal(find(app.document,el=>el.className==='lines').style.fontSize,'28px');
    assert.equal(find(app.document,el=>el.className==='delay').value,'1.5');
    app.player.destroy();
});
