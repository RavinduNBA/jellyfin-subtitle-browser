(function (root) {
    'use strict';
    root.JellyfinSubtitleTheme = function (Browser, root, element) {
    Browser.prototype.syncTheme = function (force) {
        if (!this.popup || !this.panel || !root.getComputedStyle) return;
        if (!force && Date.now() < (this.nextThemeRead || 0)) return;
        this.nextThemeRead = Date.now() + 1000;
        var doc = root.document;
        if (!this.themeProbe) {
            var probe = element(doc, 'div');
            probe.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;width:200px;contain:layout style';
            this.themeSamples = {};
            var classes = {surface:'dialog', text:'secondaryText', input:'emby-input', select:'emby-select', button:'raised emby-button', accent:'button-submit emby-button'};
            Object.keys(classes).forEach(function (name) {
                var tag = name === 'input' ? 'input' : name === 'select' ? 'select' : name === 'button' || name === 'accent' ? 'button' : 'div';
                var node = element(doc, tag, null, classes[name]);
                probe.appendChild(node); this.themeSamples[name] = node;
            }, this);
            doc.body.appendChild(probe); this.themeProbe = probe;
        }
        function color(value, fallback) { return !value || value === 'transparent' || /rgba\([^)]*,\s*0\s*\)/.test(value) ? fallback : value; }
        var base = root.getComputedStyle(doc.body), samples = this.themeSamples;
        var surface = root.getComputedStyle(samples.surface), input = root.getComputedStyle(samples.input);
        var select = root.getComputedStyle(samples.select), button = root.getComputedStyle(samples.button);
        var accent = root.getComputedStyle(samples.accent), secondary = root.getComputedStyle(samples.text);
        var background = color(surface.backgroundColor, color(base.backgroundColor, '#202020'));
        var palette = {
            bg:background,
            fg:color(surface.color, color(base.color, '#eeeeee')),
            muted:color(secondary.color, '#aaaaaa'),
            input:color(input.backgroundColor, background),
            inputFg:color(input.color, color(base.color, '#eeeeee')),
            // Native select defaults can remain white even under Jellyfin's dark CSS.
            // Match the themed text input instead of sampling the OS select surface.
            select:color(input.backgroundColor, background),
            button:color(button.backgroundColor, '#303030'),
            buttonFg:color(button.color, color(base.color, '#eeeeee')),
            border:color(input.borderTopColor, '#666666'),
            accent:color(accent.backgroundColor, '#00a4dc'),
            accentFg:color(accent.color, '#ffffff'),
            font:base.fontFamily || '"Segoe UI",sans-serif',
            radius:input.borderTopLeftRadius || '3px'
        };
        var signature = JSON.stringify(palette);
        if (signature === this.lastThemeSignature && this.lastThemeDocument === this.doc) return;
        this.lastThemeSignature = signature; this.lastThemeDocument = this.doc;
        var theme = this.doc.getElementById('jmp-sb-theme');
        if (!theme) { theme = element(this.doc, 'style'); theme.id = 'jmp-sb-theme'; this.doc.head.appendChild(theme); }
        theme.textContent = '.jmp-sb{background:' + palette.bg + '!important;color:' + palette.fg + '!important;font-family:' + palette.font + '!important}' +
            '.jmp-sb button,.jmp-sb input,.jmp-sb select{font-family:' + palette.font + '!important;border-color:' + palette.border + '!important;border-radius:' + palette.radius + '!important}' +
            '.jmp-sb input,.jmp-sb select{background:' + palette.input + '!important;color:' + palette.inputFg + '!important}.jmp-sb select,.jmp-sb select option{background:' + palette.select + '!important;color:' + palette.inputFg + '!important}.jmp-sb select{appearance:none;-webkit-appearance:none;padding-right:30px;background-image:linear-gradient(45deg,transparent 50%,' + palette.inputFg + ' 50%),linear-gradient(135deg,' + palette.inputFg + ' 50%,transparent 50%)!important;background-position:calc(100% - 16px) 50%,calc(100% - 12px) 50%!important;background-size:4px 4px!important;background-repeat:no-repeat!important}' +
            '.jmp-sb button{background:' + palette.button + '!important;color:' + palette.buttonFg + '!important}.jmp-sb .status,.jmp-sb time{color:' + palette.muted + '!important}' +
            '.jmp-sb .status{border-color:' + palette.border + '!important}.jmp-sb .cue.active{background:' + palette.accent + '!important;color:' + palette.accentFg + '!important;border-color:' + palette.accent + '!important}' +
            '.jmp-sb .cue.active time{color:inherit!important}.jmp-sb .cue:hover{background:' + palette.button + '}.jmp-sb button:focus,.jmp-sb input:focus,.jmp-sb select:focus{outline:2px solid ' + palette.accent + ';outline-offset:2px}' +
            '.jmp-sb input::placeholder{color:' + palette.muted + ';opacity:.8}.jmp-sb .lines::-webkit-scrollbar{width:10px}.jmp-sb .lines::-webkit-scrollbar-track{background:' + palette.bg + '}.jmp-sb .lines::-webkit-scrollbar-thumb{background:' + palette.border + ';border-radius:5px}';
        this.doc.body.style.backgroundColor = palette.bg;
    };
    };
})(typeof window === 'undefined' ? globalThis : window);
