(function (root) {
    'use strict';
    function parse(text) {
        if (/^\s*\[Events\]/mi.test(text) || /^Dialogue\s*:/mi.test(text)) return parseAss(text);
        var cues = [];
        function seconds(value) {
            return value.replace(',', '.').split(':').reverse().reduce(function (sum, n, i) { return sum + Number(n) * Math.pow(60, i); }, 0);
        }
        text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n\s*\n/).forEach(function (block) {
            var lines = block.trim().split('\n');
            if (/^(NOTE|WEBVTT|STYLE|REGION)/.test(lines[0])) return;
            for (var i = 0; i < lines.length; i++) {
                var match = lines[i].match(/^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/);
                if (!match) continue;
                var start = seconds(match[1]), end = seconds(match[2]);
                var body = lines.slice(i + 1).join('\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
                body = body.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, function (entity, name) {
                    var named = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};
                    if (named[name]) return named[name];
                    var code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
                    return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
                }).trim();
                if (isFinite(start) && isFinite(end) && start >= 0 && end > start && body) cues.push({start: start, end: end, text: body});
                break;
            }
        });
        return cues.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
    }
    function parseAss(text) {
        var fields = ['Layer','Start','End','Style','Name','MarginL','MarginR','MarginV','Effect','Text'];
        var cues = [], inEvents = !/^\s*\[/m.test(text);
        text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach(function (line) {
            var section = line.match(/^\s*\[([^\]]+)\]/);
            if (section) { inEvents = section[1].toLowerCase() === 'events'; return; }
            if (!inEvents) return;
            var format = line.match(/^\s*Format\s*:\s*(.*)$/i);
            if (format) { fields = format[1].split(',').map(function (s) { return s.trim(); }); return; }
            var dialogue = line.match(/^\s*Dialogue\s*:\s*(.*)$/i);
            if (!dialogue) return;
            var names = fields.map(function (s) { return s.toLowerCase(); });
            var textIndex = names.indexOf('text'), startIndex = names.indexOf('start'), endIndex = names.indexOf('end');
            if (textIndex < 0 || startIndex < 0 || endIndex < 0) return;
            var values = dialogue[1].split(',');
            var extra = values.length - fields.length;
            if (extra > 0) values.splice(textIndex, extra + 1, values.slice(textIndex, textIndex + extra + 1).join(','));
            if (values.length !== fields.length) return;
            function seconds(value) { return value.trim().split(':').reverse().reduce(function (sum, n, i) { return sum + Number(n) * Math.pow(60, i); }, 0); }
            var start = seconds(values[startIndex]), end = seconds(values[endIndex]);
            var drawing = false;
            var body = values[textIndex].replace(/\{([^}]*)\}|([^{}]+)/g, function (match, tags, literal) {
                if (tags !== undefined) { var mode = tags.match(/\\p(\d+)/); if (mode) drawing = Number(mode[1]) > 0; return ''; }
                return drawing ? '' : literal;
            }).replace(/\\[Nn]/g, '\n').replace(/\\h/g, ' ').trim();
            if (isFinite(start) && isFinite(end) && start >= 0 && end > start && body) cues.push({start: start, end: end, text: body});
        });
        return cues.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
    }
    function clock(seconds) {
        seconds = Math.max(0, Math.floor(seconds));
        return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
    }
    function connection(options, apiClient) {
        var address, token;
        try {
            var url = new URL(options.url);
            var route = url.pathname.search(/\/(Videos|Items|Audio)\//i);
            if (route >= 0 && /^https?:$/.test(url.protocol)) address = url.origin + url.pathname.slice(0, route);
            token = url.searchParams.get('api_key') || url.searchParams.get('apiKey');
        } catch (ignored) { /* A direct file path is not an API address. */ }
        if (apiClient) {
            address = address || (typeof apiClient.serverAddress === 'function' && apiClient.serverAddress());
            token = token || (typeof apiClient.accessToken === 'function' && apiClient.accessToken());
        }
        if (!address || !token || !/^https?:\/\//i.test(address)) throw new Error('The current playback session did not provide a usable Jellyfin connection.');
        return {address: address.replace(/\/$/, ''), token: token};
    }
    function subtitleUrl(conn, options, index, format) {
        return conn.address + '/Videos/' + [options.item.Id, options.mediaSource.Id, index].map(encodeURIComponent).join('/').replace(/\/([^/]+)$/, '/Subtitles/$1') + '/Stream.' + (format || 'srt');
    }
    function active(cues, position) {
        var latest = -1;
        for (var i = 0; i < cues.length && cues[i].start <= position; i++) latest = i;
        if (latest < 0) return [];
        var currentStart = cues[latest].start;
        return cues.map(function (cue, index) {
            // Retain the latest dialogue through silence; preserve active overlaps.
            return cue.start <= position && (position < cue.end || cue.start === currentStart) ? index : -1;
        }).filter(function (index) { return index >= 0; });
    }
    var core = {parse: parse, clock: clock, connection: connection, subtitleUrl: subtitleUrl, active: active};
    if (typeof module !== 'undefined' && module.exports) module.exports = core;
    else root.JellyfinSubtitleCore = core;
})(typeof window === 'undefined' ? globalThis : window);
