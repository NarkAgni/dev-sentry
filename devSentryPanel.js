import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';

import { LogManager, LogType } from './logManager.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';


const TYPE_STYLE = {
    [LogType.ERROR]:    { row: 'row-error',    label: 'label-error'    },
    [LogType.CRITICAL]: { row: 'row-critical', label: 'label-critical' },
    [LogType.TRACE]:    { row: 'row-trace',    label: 'label-trace'    },
    [LogType.SOURCE]:   { row: 'row-source',   label: 'label-source'   },
};

const FILTER_TOGGLES = [
    { type: LogType.ERROR,    label: 'Errors',   activeClass: 'toggle-error'    },
    { type: LogType.CRITICAL, label: 'Critical', activeClass: 'toggle-critical' },
    { type: LogType.SOURCE,   label: 'Fix',      activeClass: 'toggle-source'   },
    { type: LogType.TRACE,    label: 'Trace',    activeClass: 'toggle-trace'    },
];

export const DevSentryPanel = GObject.registerClass(
class DevSentryPanel extends PanelMenu.Button {
    _init(settings, openPreferences) {
        super._init(0.5, 'DevSentry', false);

        this._settings        = settings;
        this._openPreferences = openPreferences;
        this._activeFilters   = new Set([LogType.ERROR, LogType.CRITICAL, LogType.TRACE, LogType.SOURCE]);
        this._rowsByType = {
            [LogType.ERROR]:    [],
            [LogType.CRITICAL]: [],
            [LogType.TRACE]:    [],
            [LogType.SOURCE]:   [],
        };
        this._currentBlockIndex = 0;

        this.add_child(new St.Icon({
            icon_name: 'utilities-terminal-symbolic',
            style_class: 'system-status-icon',
        }));

        this._logManager = new LogManager(settings, (line, type) => this._addErrorRow(line, type));
        this._buildUI();

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._updateFilteringLabel();
            return GLib.SOURCE_REMOVE;
        });

        this._settingsSignal = this._settings.connect('changed::project-path', () => {
            this._updateFilteringLabel();
        });

        this._logManager.start(false);
    }

    _notify(title, msg) {
        if (this._settings.get_boolean('show-notifications'))
            Main.notify(title, msg);
    }

    _buildUI() {
        let root = new St.BoxLayout({ vertical: true, style_class: 'dev-sentry-panel' });
        root.add_child(this._buildHeader());
        root.add_child(this._buildFilterBar());
        root.add_child(this._buildLogScroll());
        this.menu.box.add_child(root);
    }

    _buildHeader() {
        let box = new St.BoxLayout({ style_class: 'header-box', y_align: Clutter.ActorAlign.CENTER });
        box.add_child(new St.Label({ text: 'DevConsole', style_class: 'header-label', y_align: Clutter.ActorAlign.CENTER }));
        box.add_child(new St.Widget({ x_expand: true }));

        // Launch the nested shell via systemd as a transient unit over
        // D-Bus instead of spawning a raw subprocess from inside gnome-shell.
        // StartTransientUnit takes: name, mode, properties a(sv), aux a(sa(sv)).
        // ExecStart is typed a(sasb): [(executable, argv[], ignore-failure)].
        let launchBtn = new St.Button({ label: 'Nested Shell', style_class: 'nested-shell-btn', y_align: Clutter.ActorAlign.CENTER });
        launchBtn.connect('clicked', () => {
            this._notify('Dev Sentry', 'Launching Nested Shell...');

            const execStart = new GLib.Variant('a(sasb)', [[
                '/bin/sh',
                ['/bin/sh', '-c',
                    'dbus-run-session -- gnome-shell --nested --wayland 2>&1 | logger -t gnome-shell-nested'],
                false,
            ]]);

            const params = new GLib.Variant('(ssa(sv)a(sa(sv)))', [
                'dev-sentry-nested-shell.service',
                'replace',
                [
                    ['Description', GLib.Variant.new_string('Dev Sentry – Nested GNOME Shell')],
                    ['ExecStart',   execStart],
                    ['Type',        GLib.Variant.new_string('oneshot')],
                ],
                [],
            ]);

            Gio.DBus.session.call(
                'org.freedesktop.systemd1',
                '/org/freedesktop/systemd1',
                'org.freedesktop.systemd1.Manager',
                'StartTransientUnit',
                params,
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (conn, res) => {
                    try {
                        conn.call_finish(res);
                    } catch (e) {
                        console.error('DevSentry: StartTransientUnit failed', e);
                        this._notify('Dev Sentry', `Launch failed: ${e.message}`);
                    }
                }
            );
        });
        box.add_child(launchBtn);

        let fetchBtn = this._makeIconBtn('view-refresh-symbolic', 'icon-btn');
        fetchBtn.connect('clicked', () => {
            this._logManager.stop();
            this._logManager.start(true);
            this._notify('Dev Sentry', 'Refreshing logs...');
        });
        box.add_child(fetchBtn);

        let pathBtn = this._makeIconBtn('folder-open-symbolic', 'icon-btn');
        pathBtn.connect('clicked', () => {
            try {
                this._openPreferences?.();
            } catch (e) {
                console.error('DevSentry: Failed to open prefs', e);
            }
        });
        box.add_child(pathBtn);

        let copyBtn = this._makeIconBtn('edit-copy-symbolic', 'icon-btn');
        copyBtn.connect('clicked', () => {
            let content = this._logManager.buffer.join('\n');
            if (content && content.length > 0) {
                St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, content);
                this._notify('Dev Sentry', 'All logs copied to clipboard.');
            } else {
                this._notify('Dev Sentry', 'Log buffer is empty.');
            }
        });
        box.add_child(copyBtn);

        let clearBtn = this._makeIconBtn('user-trash-symbolic', 'icon-btn btn-clear');
        clearBtn.connect('clicked', () => {
            this._logList.destroy_all_children();
            for (let t of Object.keys(this._rowsByType)) this._rowsByType[t] = [];
            this._currentBlockIndex = 0;
            this._logManager.clearBuffer();
        });
        box.add_child(clearBtn);

        return box;
    }

    _buildFilterBar() {
        let box = new St.BoxLayout({ style_class: 'toolbar-box', y_align: Clutter.ActorAlign.CENTER });
        for (let cfg of FILTER_TOGGLES) {
            let btn = new St.Button({ label: cfg.label, style_class: `filter-toggle ${cfg.activeClass} active`, y_align: Clutter.ActorAlign.CENTER });
            btn.connect('clicked', () => this._toggleType(cfg.type, btn, cfg));
            box.add_child(btn);
        }
        box.add_child(new St.Widget({ x_expand: true }));
        this._filteringLabel = new St.Label({ text: '', style_class: 'filtering-label', y_align: Clutter.ActorAlign.CENTER });
        this._filteringLabel.hide();
        box.add_child(this._filteringLabel);
        return box;
    }

    _updateFilteringLabel() {
        let uuid = this._logManager.getActiveUUID();
        if (uuid) {
            this._filteringLabel.text = `Filtering: ${uuid}`;
            this._filteringLabel.show();
        } else {
            this._filteringLabel.hide();
        }
    }

    _toggleType(type, btn, cfg) {
        if (this._activeFilters.has(type)) {
            this._activeFilters.delete(type);
            btn.style_class = `filter-toggle ${cfg.activeClass} inactive`;
        } else {
            this._activeFilters.add(type);
            btn.style_class = `filter-toggle ${cfg.activeClass} active`;
        }
        for (let row of (this._rowsByType[type] ?? []))
            this._activeFilters.has(type) ? row.show() : row.hide();
    }

    _buildLogScroll() {
        this._logList = new St.BoxLayout({ vertical: true, x_expand: true });
        let scroll = new St.ScrollView({ hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC, style_class: 'log-scroll-view' });
        scroll.set_child(this._logList);
        return scroll;
    }

    _addErrorRow(text, type) {
        let style = TYPE_STYLE[type] ?? TYPE_STYLE[LogType.ERROR];
        let label = new St.Label({ text, style_class: `error-text-label ${style.label}`, x_expand: true });
        label.clutter_text.line_wrap = true;
        label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;

        let escaped = GLib.markup_escape_text(text, -1);
        let markup = escaped
            .replace(/^CRITICAL:/, '<b>CRITICAL:</b>')
            .replace(/^ERROR:/,    '<b>ERROR:</b>')
            .replace(/^FIX:/,      '<b>FIX:</b>')
            .replace(/^TRACE:/,    '<b>TRACE:</b>');
        label.clutter_text.set_markup(markup);

        let btn = new St.Button({ style_class: `error-row-btn ${style.row}`, child: label, x_expand: true, x_align: Clutter.ActorAlign.FILL });
        if (!this._activeFilters.has(type)) btn.hide();

        btn.connect('clicked', () => {
            let match = /(file:\/\/[^:\s]+?\.js):(\d+)/.exec(text);
            if (match) {
                this._openInEditor({ path: match[1].replace('file://', ''), line: match[2] });
            } else {
                St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
                this._notify('Dev Sentry', 'Path not found. Text copied.');
            }
        });

        if (type === LogType.CRITICAL || type === LogType.ERROR) {
            this._currentBlockIndex = 0;
            this._logList.insert_child_at_index(btn, 0);
            this._currentBlockIndex++;
        } else {
            let count = this._logList.get_n_children();
            let idx = Math.min(this._currentBlockIndex, count);
            this._logList.insert_child_at_index(btn, idx);
            this._currentBlockIndex++;
        }
        let children = this._logList.get_children();
        if (children.length > 250) children[children.length - 1].destroy();
        this._rowsByType[type].push(btn);
    }

    _openInEditor({ path, line }) {
        this._notify('Dev Sentry', 'Opening in VS Code...');

        const uri = `vscode://file${path}:${line}`;

        Gio.DBus.session.call(
            'org.freedesktop.portal.Desktop',
            '/org/freedesktop/portal/desktop',
            'org.freedesktop.portal.OpenURI',
            'OpenURI',
            new GLib.Variant('(ssa{sv})', ['', uri, {}]),
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (conn, res) => {
                try {
                    conn.call_finish(res);
                    this.menu.close();
                } catch (e) {
                    console.error('DevSentry: OpenURI portal failed', e);
                    this._notify('Dev Sentry', `Failed to open editor: ${e.message}`);
                }
            }
        );
    }

    _makeIconBtn(iconName, styleClass) {
        return new St.Button({ style_class: styleClass, child: new St.Icon({ icon_name: iconName, icon_size: 16 }) });
    }

    destroy() {
        if (this._settingsSignal) this._settings.disconnect(this._settingsSignal);
        this._logManager.stop();
        super.destroy();
    }
});