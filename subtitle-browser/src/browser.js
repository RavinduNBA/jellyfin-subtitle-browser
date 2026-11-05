(function (root) {
    'use strict';
    var core = root.JellyfinSubtitleCore;
    var parse = core.parse, clock = core.clock, connection = core.connection;
    var subtitleUrl = core.subtitleUrl, active = core.active;
    if (!root._mpvVideoPlayer || root._mpvVideoPlayer.prototype.__subtitleBrowser) return;
    var proto = root._mpvVideoPlayer.prototype;
    proto.__subtitleBrowser = true;
    var controller;

    function element(doc, tag, text, className) {
        var el = doc.createElement(tag);
        if (text != null) el.textContent = text;
        if (className) el.className = className;
        return el;
    }
    function Browser(player) {
        this.player = player;
        var stored = root.jmpInfo && root.jmpInfo.settings && root.jmpInfo.settings.subtitle_browser;
        // NativeShell defines non-enumerable getters. Object.assign silently
        // drops these values, so read each supported preference explicitly.
        var saved = stored || root.__jmpSubtitlePreferences || {};
        this.preferences = {
            font_size: Number(saved.font_size) || 16,
            extra_delay: Number(saved.extra_delay) || 0
        };
        this.fontSize = Math.min(32, Math.max(12, Number(this.preferences.font_size) || 16));
        this.cues = [];
        this.generation = 0;
        this.follow = true;
        this.override = null;
        this.key = null;
        this.options = null;
        this.abort = null;
        this.doc = root.document;
        this.popup = null;
        this.visible = false;
        this.button = element(this.doc, 'button', null, 'jmp-sb-launch autoSize paper-icon-button-light');
        this.button.type = 'button';
        this.button.setAttribute('aria-label', 'Subtitle Browser');
        var icon = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        var iconAttributes = {viewBox: '0 0 24 24', width: '24', height: '24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', 'class': 'jmp-sb-icon'};
        Object.keys(iconAttributes).forEach(function (name) { icon.setAttribute(name, iconAttributes[name]); });
        var frame = this.doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
        [['x','3'],['y','4'],['width','18'],['height','16'],['rx','2']].forEach(function (pair) { frame.setAttribute(pair[0], pair[1]); });
        var lines = this.doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        lines.setAttribute('d', 'M3 8h18M7 12h10M7 16h6');
        icon.appendChild(frame); icon.appendChild(lines); this.button.appendChild(icon);
        this.button.title = 'Browse dialogue · Ctrl+Shift+B';
        var self = this;
        this.button.onclick = function () { self.toggle(); };
        this.keyboard = function (event) {
            if (event.ctrlKey && event.shiftKey && event.code === 'KeyB') { event.preventDefault(); self.toggle(); }
        };
        this.doc.addEventListener('keydown', this.keyboard);
        this.nativeClosed = function () {
            self.popup = null; self.visible = false; self.panel = null;
            self.generation++; self.key = null;
            if (self.abort) self.abort.abort();
        };
        root.addEventListener('jmp-subtitle-window-closed', this.nativeClosed);
        this.timer = root.setInterval(function () { self.tick(); }, 150);
        this.style(this.doc);
    }
    Browser.prototype.savePreference = function (key, value) {
        this.preferences[key] = value;
        root.__jmpSubtitlePreferences = Object.assign({}, this.preferences);
        if (root.api && root.api.settings && root.api.settings.setValue)
            root.api.settings.setValue('subtitle_browser', key, value);
    };
    Browser.prototype.style = function (doc) {
        if (doc.getElementById('jmp-sb-style')) return;
        var style = element(doc, 'style');
        style.id = 'jmp-sb-style';
        style.textContent = root.JellyfinSubtitleStyles;
        (doc.head || doc.documentElement).appendChild(style);
    };
    Browser.prototype.mount = function (doc) {
        var self = this;
        var savedSearch = this.search ? this.search.value : '';
        var savedDelay = this.delay ? this.delay.value : String(Number(this.preferences.extra_delay) || 0);
        this.doc = doc;
        this.style(doc);
        this.panel = element(doc, 'section', null, 'jmp-sb');
        if (this.popup) {
            // Qt 5's Chromium does not support CSS inset. Set every edge explicitly.
            this.panel.style.left = '0'; this.panel.style.top = '0';
            this.panel.style.right = '0'; this.panel.style.bottom = '0';
            this.panel.style.width = '100%'; this.panel.style.height = '100%';
            this.panel.style.boxSizing = 'border-box';
            this.panel.style.border = '0'; this.panel.style.borderRadius = '0';
            doc.body.style.margin = '0'; doc.body.style.overflow = 'hidden';
        }
        this.panel.setAttribute('aria-label', 'Subtitle Browser');
        var tools = element(doc, 'div', null, 'tools');
        this.track = element(doc, 'select');
        this.track.setAttribute('aria-label', 'Transcript subtitle track');
        this.track.onchange = function () { self.override = self.track.value === 'auto' ? null : Number(self.track.value); self.key = null; self.tick(); };
        tools.appendChild(this.track);
        this.search = element(doc, 'input');
        this.search.type = 'search';
        this.search.value = savedSearch;
        this.search.placeholder = 'Search dialogue';
        this.search.setAttribute('aria-label', 'Search dialogue');
        this.search.oninput = function () { self.render(); };
        tools.appendChild(this.search);
        var follow = element(doc, 'button', 'Back to current line');
        follow.onclick = function () { self.search.value = ''; self.follow = true; self.render(); self.highlight(true); };
        tools.appendChild(follow);
        this.time = element(doc, 'span', '00:00:00');
        tools.appendChild(this.time);
        var delayLabel = element(doc, 'label', 'Extra delay (s)');
        this.delay = element(doc, 'input', null, 'delay');
        this.delay.type = 'number'; this.delay.step = '0.1'; this.delay.value = savedDelay;
        this.delay.setAttribute('aria-label', 'Additional subtitle delay in seconds');
        this.delay.onchange = function () {
            var value = Number(self.delay.value);
            if (isFinite(value) && Math.abs(value) <= 3600) self.savePreference('extra_delay', value);
        };
        delayLabel.appendChild(this.delay); tools.appendChild(delayLabel);
        var size = this.fontSize || 16;
        ['A−', 'A+'].forEach(function (name, i) {
            var button = element(doc, 'button', name);
            button.onclick = function () { size = Math.min(32, Math.max(12, size + (i ? 2 : -2))); self.fontSize = size; self.lines.style.fontSize = size + 'px'; self.savePreference('font_size', size); };
            tools.appendChild(button);
        });
        var retry = element(doc, 'button', 'Retry');
        retry.onclick = function () { self.key = null; self.tick(); };
        tools.appendChild(retry);
        this.panel.appendChild(tools);
        this.lines = element(doc, 'div', null, 'lines');
        this.lines.style.fontSize = size + 'px';
        this.lines.setAttribute('role', 'list');
        this.lines.addEventListener('wheel', function () { self.follow = false; }, {passive: true});
        this.lines.addEventListener('touchmove', function () { self.follow = false; }, {passive: true});
        this.lines.addEventListener('keydown', function (event) { if (/^(Arrow|Page|Home|End)/.test(event.key)) self.follow = false; });
        this.panel.appendChild(this.lines);
        this.status = element(doc, 'div', 'Loading transcript…', 'status');
        this.status.setAttribute('role', 'status');
        this.panel.appendChild(this.status);
        doc.body.appendChild(this.panel);
        this.updateTracks(); this.render();
        this.syncTheme(true);
        if (this.popup) {
            var view = this.popup;
            view.requestAnimationFrame(function () {
                view.requestAnimationFrame(function () {
                    if (!view.closed) doc.documentElement.setAttribute('data-jmp-subtitle-ready', 'true');
                });
            });
        }
    };
    Browser.prototype.updateTracks = function () {
        if (!this.track) return;
        this.track.textContent = '';
        var automatic = element(this.doc, 'option', 'Follow player subtitle track');
        automatic.value = 'auto'; this.track.appendChild(automatic);
        ((this.options && this.options.mediaSource.MediaStreams) || []).filter(function (s) { return s.Type === 'Subtitle'; }).forEach(function (stream) {
            var option = element(this.doc, 'option', stream.DisplayTitle || stream.Language || stream.Codec || 'Subtitle');
            option.value = String(stream.Index); this.track.appendChild(option);
        }, this);
        this.track.value = this.override === null ? 'auto' : String(this.override);
    };
    Browser.prototype.toggle = function () {
        if (this.visible) { this.hide(); return; }
        if (!root.jmpInfo || !root.jmpInfo.subtitleBrowserWindow) {
            this.button.title = 'Install the native Subtitle Browser build to open this window.';
            return;
        }
        this.visible = true;
        this.openWindow();
        this.key = null;
        this.tick();
    };
    Browser.prototype.hide = function () {
        this.visible = false;
        if (this.abort) this.abort.abort();
        this.generation++;
        this.key = null;
        if (this.popup) {
            var popup = this.popup; this.popup = null;
            popup.close();
        } else if (this.panel) this.panel.remove();
        this.panel = null;
    };
    Browser.prototype.openWindow = function () {
        var popup = root.open('about:blank#jellyfin-subtitle-browser', 'jellyfin-subtitle-browser', 'width=760,height=850');
        if (!popup) { this.visible = false; this.button.title = 'Unable to open the native subtitle window. Try again.'; return; }
        if (this.panel) this.panel.remove();
        this.popup = popup;
        popup.document.title = 'Jellyfin · Subtitle Browser';
        popup.document.body.className = 'jmp-sb-pop';
        this.mount(popup.document);
        var self = this;
        popup.addEventListener('beforeunload', function () {
            if (self.popup === popup) {
                self.popup = null; self.visible = false; self.panel = null;
                self.generation++; self.key = null;
                if (self.abort) self.abort.abort();
            }
        });
    };
    Browser.prototype.attachLauncher = function () {
        var doc = root.document;
        function current(selector) {
            if (!doc.querySelectorAll) return doc.querySelector(selector);
            var nodes = Array.prototype.slice.call(doc.querySelectorAll(selector));
            var rendered = nodes.filter(function (node) { return !node.getClientRects || node.getClientRects().length > 0; });
            // Jellyfin retains old OSD pages in the DOM between videos.
            return rendered[rendered.length - 1] || nodes[nodes.length - 1];
        }
        var anchor = current('.videoOsdBottom .btnSubtitles');
        if (anchor && anchor.parentNode) {
            if (this.button.parentNode !== anchor.parentNode || anchor.nextSibling !== this.button)
                anchor.parentNode.insertBefore(this.button, anchor.nextSibling);
        } else {
            var toolbar = current('.videoOsdBottom .buttons');
            if (toolbar && this.button.parentNode !== toolbar) toolbar.appendChild(this.button);
        }
    };
    Browser.prototype.tick = function () {
        var options = this.player._currentPlayOptions;
        this.attachLauncher();
        this.button.hidden = !options;
        this.button.setAttribute('aria-pressed', this.visible ? 'true' : 'false');
        this.syncTheme(false);
        if (!options) {
            if (this.options) {
                this.options = null; this.key = null; this.cues = []; this.generation++;
                if (this.abort) this.abort.abort();
                if (this.visible && this.panel) { this.render(); this.status.textContent = 'Playback stopped. Start a video to load its subtitles.'; }
            }
            return;
        }
        if (options !== this.options) {
            this.options = options; this.override = null; this.key = null; this.cues = []; this.updateTracks();
        }
        if (!this.visible || !this.panel) return;
        var index = this.override === null ? this.player._subtitleTrackIndexToSetOnPlaying : this.override;
        var key = options.item.Id + ':' + options.mediaSource.Id + ':' + index;
        if (this.key !== key) { this.key = key; this.load(options, index); }
        this.highlight(false);
    };
    Browser.prototype.load = async function (options, index) {
        if (this.abort) this.abort.abort();
        this.abort = new AbortController();
        var generation = ++this.generation;
        this.cues = []; this.render();
        var stream = options.mediaSource.MediaStreams.find(function (s) { return s.Type === 'Subtitle' && Number(s.Index) === Number(index); });
        if (!stream) { this.status.textContent = 'Subtitles are off. Enable them in the player or choose a transcript track above.'; return; }
        if (stream.IsTextSubtitleStream === false || /^(pgssub|dvdsub|dvbsub|hdmv_pgs_subtitle|dvd_subtitle)$/i.test(stream.Codec || '')) {
            this.status.textContent = 'Image-based subtitles cannot be browsed as text. Choose an SRT, ASS, or WebVTT track.'; return;
        }
        this.status.textContent = 'Loading subtitle transcript…';
        var timeout = root.setTimeout(function (abort) { abort.abort(); }, 30000, this.abort);
        try {
            var api = root.ApiClient;
            if (!api && root.ServerConnections && root.ServerConnections.getApiClient) api = root.ServerConnections.getApiClient(options.item.ServerId);
            var conn = connection(options, api);
            // Preserve ASS/SSA source rather than depending on server-side SRT conversion.
            var codec = (stream.Codec || '').toLowerCase();
            var format = /^(ass|ssa)$/.test(codec) ? codec : 'srt';
            var requestOptions = {
                headers: {'X-Emby-Token': conn.token}, credentials: 'same-origin', redirect: 'error', signal: this.abort.signal
            };
            var response = await root.fetch(subtitleUrl(conn, options, index, format), requestOptions);
            if (!response.ok && format !== 'srt' && response.status !== 401 && response.status !== 403)
                response = await root.fetch(subtitleUrl(conn, options, index, 'srt'), requestOptions);
            if (!response.ok) throw new Error(response.status === 401 ? 'Your Jellyfin session expired. Reconnect in the player.' : 'Jellyfin could not extract this subtitle track (HTTP ' + response.status + ').');
            var cues = parse(await response.text());
            if (generation !== this.generation) return;
            this.cues = cues; this.render(); this.highlight(true);
            this.status.textContent = cues.length ? cues.length + ' lines · Player clock · double-click a line to replay · scroll to browse history' : 'No readable lines were returned for this track.';
        } catch (error) {
            if (generation === this.generation && this.panel) this.status.textContent = error.name === 'AbortError' ? 'Subtitle extraction timed out. Use Retry.' : error.message;
        } finally { root.clearTimeout(timeout); }
    };
    Browser.prototype.render = function () {
        if (!this.lines) return;
        this.lines.textContent = ''; this.rows = [];
        var query = this.search.value.trim().toLocaleLowerCase();
        var self = this;
        this.cues.forEach(function (cue, index) {
            if (query && cue.text.toLocaleLowerCase().indexOf(query) < 0) return;
            var row = element(self.doc, 'div', null, 'cue');
            row.setAttribute('role', 'listitem'); row.tabIndex = 0;
            row.appendChild(element(self.doc, 'time', clock(cue.start) + ' → ' + clock(cue.end)));
            row.appendChild(element(self.doc, 'span', cue.text));
            var options = self.options;
            var seek = function () {
                if (self.player._currentPlayOptions !== options || !self.player.seekable()) return;
                var offset = (Number(self.player.getSubtitleOffset()) || 0) + (Number(self.delay.value) || 0);
                self.player.currentTime(Math.max(0, (cue.start + offset) * 1000));
                self.follow = true;
            };
            row.ondblclick = seek;
            row.onkeydown = function (event) { if (event.key === 'Enter') { event.preventDefault(); seek(); } };
            self.lines.appendChild(row); self.rows.push({index: index, el: row});
        });
        if (!this.rows.length) this.lines.appendChild(element(this.doc, 'p', query ? 'No matching dialogue.' : 'No transcript loaded.'));
        this.lastAnchor = null;
    };
    Browser.prototype.highlight = function (force) {
        if (!this.visible || !this.panel || !this.player._currentPlayOptions) return;
        var ms = Number(this.player.currentTime());
        if (!isFinite(ms)) return;
        this.time.textContent = clock(ms / 1000);
        var position = ms / 1000 - (Number(this.player.getSubtitleOffset()) || 0) - (Number(this.delay.value) || 0);
        var selected = active(this.cues, position), anchor = selected[0];
        if (anchor === undefined) {
            anchor = 0;
            for (var i = 0; i < this.cues.length && this.cues[i].start <= position; i++) anchor = i;
        }
        this.rows.forEach(function (row) {
            row.el.classList.toggle('active', selected.indexOf(row.index) >= 0);
            row.el.setAttribute('aria-current', selected.indexOf(row.index) >= 0 ? 'true' : 'false');
            if (row.index === anchor && this.follow && !this.search.value.trim() && (force || anchor !== this.lastAnchor)) {
                this.lines.scrollTop = Math.max(0, row.el.offsetTop - this.lines.offsetTop - this.lines.clientHeight * .4);
            }
        }, this);
        this.lastAnchor = anchor;
    };
    Browser.prototype.dispose = function () {
        this.hide(); root.clearInterval(this.timer); this.button.remove();
        root.document.removeEventListener('keydown', this.keyboard);
        root.removeEventListener('jmp-subtitle-window-closed', this.nativeClosed);
        if (this.themeProbe) this.themeProbe.remove();
    };
    root.JellyfinSubtitleTheme(Browser, root, element);
    var original = proto.setCurrentSrc;
    proto.setCurrentSrc = function () {
        if (controller && controller.player !== this) { controller.dispose(); controller = null; }
        if (!controller) controller = new Browser(this);
        var result = original.apply(this, arguments);
        controller.tick();
        return result;
    };
    var destroy = proto.destroy;
    proto.destroy = function () {
        if (controller && controller.player === this) { controller.dispose(); controller = null; }
        return destroy.apply(this, arguments);
    };
})(typeof window === 'undefined' ? globalThis : window);
