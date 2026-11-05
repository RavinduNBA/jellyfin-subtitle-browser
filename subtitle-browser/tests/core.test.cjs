const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core.js');

test('parses Unicode, entities, multiline SRT and safe text', () => {
    assert.deepEqual(core.parse('\uFEFF1\r\n00:01:02,500 --> 00:01:05,000\r\n<i>日本語 &amp; English</i>\r\n&#x1F600; &lt;script&gt;\r\n'),
        [{start: 62.5, end: 65, text: '日本語 & English\n😀 <script>'}]);
});
test('supports WebVTT IDs and cue settings, ignores notes and invalid ranges', () => {
    assert.deepEqual(core.parse('WEBVTT\n\nNOTE test\n00:00.000 --> 00:10.000\nignore\n\nid\n00:02.500 --> 00:03.000 align:start\nHi<br>there\n\n2\n00:04.000 --> 00:03.000\nignore'),
        [{start: 2.5, end: 3, text: 'Hi\nthere'}]);
});
test('overlaps highlight together and latest dialogue stays highlighted until the next start', () => {
    const cues = [{start: 1, end: 3}, {start: 2, end: 4}, {start: 6, end: 8}];
    assert.deepEqual(core.active(cues, 2), [0, 1]);
    assert.deepEqual(core.active(cues, 3), [1]);
    assert.deepEqual(core.active(cues, 5), [1]);
    assert.deepEqual(core.active(cues, 6), [2]);
    assert.deepEqual(core.active(cues, 100), [2]);
    assert.deepEqual(core.active(cues, 0), []);
    assert.deepEqual(core.active(cues, 1.5), [0]);
});
test('reuses playback authentication and preserves server base path', () => {
    const conn = core.connection({url: 'https://server.example/jellyfin/Videos/item/stream.mkv?api_key=current-session'});
    assert.deepEqual(conn, {address: 'https://server.example/jellyfin', token: 'current-session'});
    assert.equal(core.subtitleUrl(conn, {item: {Id: 'item'}, mediaSource: {Id: 'source'}}, 4),
        'https://server.example/jellyfin/Videos/item/source/Subtitles/4/Stream.srt');
    assert.ok(!core.subtitleUrl(conn, {item: {Id: 'item'}, mediaSource: {Id: 'source'}}, 4).includes('current-session'));
});
test('uses in-client API connection for direct files without reading credential storage', () => {
    const conn = core.connection({url: 'file:///movie.mkv'}, {serverAddress: () => 'https://server.example', accessToken: () => 'existing'});
    assert.equal(conn.token, 'existing');
    assert.throws(() => core.connection({url: 'file:///movie.mkv'}), /current playback session/);
});
test('formats long subtitle timestamps', () => assert.equal(core.clock(3662.5), '01:01:02'));

test('ASS dialogue preserves commas and line breaks while removing style and drawing commands', () => {
    const ass = '[Script Info]\nScriptType: v4.00+\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n' +
        'Comment: 0,0:00:00.00,0:00:03.00,Default,,0,0,0,,Ignore\n' +
        'Dialogue: 0,0:00:01.25,0:00:04.50,Default,,0,0,0,,{\\an8}{\\i1}Hello, world!{\\i0}\\N日本語\\htext\n' +
        'Dialogue: 0,0:00:02.00,0:00:05.00,Default,,0,0,0,,{\\p1}m 0 0 l 10 10{\\p0}Spoken text';
    assert.deepEqual(core.parse(ass), [{start:1.25,end:4.5,text:'Hello, world!\n日本語 text'}, {start:2,end:5,text:'Spoken text'}]);
});
test('SSA legacy Marked events and changed Format order are parsed', () => {
    const ssa = '[Events]\nFormat: Marked, End, Start, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: Marked=0,0:01:05.00,0:01:02.50,Default,,0,0,0,,{\\b1}Earlier line\\nnext line';
    assert.deepEqual(core.parse(ssa), [{start:62.5,end:65,text:'Earlier line\nnext line'}]);
});
