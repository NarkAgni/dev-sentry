import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const LogType = Object.freeze({
    ERROR:    'error',
    CRITICAL: 'critical',
    TRACE:    'trace',
    SOURCE:   'source',
});

const CRIT_KEYS  = ['Gjs-CRITICAL', 'fatal', 'GLib-GObject'];
const ERROR_KEYS = ['JS ERROR', 'TypeError', 'ReferenceError', 'SyntaxError', 'Error:', 'Extension '];

const STACK_FRAME_RE = /file:\/\/.*\.js:\d+/;
const IGNORE_RE = /^\s*(Stack trace:|==\s*Stack trace for context)/;

const GREP_PATTERN = 'JS ERROR|TypeError|ReferenceError|SyntaxError|Gjs-CRITICAL|GNOME Shell-CRITICAL|Extension |file://';
const FILE_PATH_RE = /((?:file:\/\/|\/)[^\s,'"]+?\.js):(\d+)/;

export class LogManager {
    constructor(settings, onLine) {
        this._settings       = settings;
        this._onLine         = onLine;
        this._cancelled      = false;

        this._seenLines      = new Set();
        this._history        = [];
        this._inErrorBlock   = false;
        this._firstFrameDone = false;

        const cacheDir  = GLib.get_user_cache_dir();
        this._sinceFile = GLib.build_filenamev([cacheDir, 'dev-sentry-since.txt']);
        this._fetchProc = null;
    }

    start(restoreMode = false) {
        this._cancelled = false;
        if (!restoreMode) {
            this._writeSince(GLib.DateTime.new_now_local().format('%Y-%m-%d %H:%M:%S'));
        } 
        this._runFetch(this._buildSinceCmd(restoreMode));
    }

    stop() {
        this._cancelled = true;
        this._killFetch();
    }

    clearBuffer() {
        this._history        = [];
        this._seenLines.clear();
        this._inErrorBlock   = false;
        this._firstFrameDone = false;
        this._writeSince(GLib.DateTime.new_now_local().format('%Y-%m-%d %H:%M:%S'));
    }

    get buffer() { return this._history.map(e => e.text); }

    parseFilePath(text) {
        let m = FILE_PATH_RE.exec(text);
        if (!m) return null;
        return { path: m[1].replace('file://', ''), line: m[2] };
    }

    getActiveUUID() {
        let p = this._settings.get_string('project-path').trim();
        if (!p) return null;
        return p.replace(/\/+$/, '').split('/').pop() || null;
    }

    _readSince() {
        try {
            let f = Gio.File.new_for_path(this._sinceFile);
            if (!f.query_exists(null)) return null;
            let [, bytes] = f.load_contents(null);
            return new TextDecoder().decode(bytes).trim() || null;
        } catch (_) { return null; }
    }

    _writeSince(ts) {
        try {
            Gio.File.new_for_path(this._sinceFile)
                .replace_contents(ts, null, false, Gio.FileCreateFlags.NONE, null);
        } catch (e) { console.error('[DevSentry] since-file write failed:', e); }
    }

    _buildSinceCmd(restoreMode) {
        let since;
        if (restoreMode) {
            let now = GLib.DateTime.new_now_local();
            let past = now.add_minutes(-3);
            since = past.format('%Y-%m-%d %H:%M:%S');
        } else {
            since = this._readSince();
        }

        let jCmd  = `journalctl -o cat _EXE=/usr/bin/gnome-shell + SYSLOG_IDENTIFIER=gnome-shell-nested`;
        jCmd += since ? ` --since "${since}"` : ` -n 200`;
        jCmd += ` | grep -E '${GREP_PATTERN}'`;
        return jCmd;
    }

    _killFetch() {
        if (this._fetchProc) {
            try { this._fetchProc.force_exit(); } catch (_) {}
            this._fetchProc = null;
        }
    }

    _runFetch(jCmd) {
        this._killFetch();
        try {
            let proc = new Gio.Subprocess({
                argv:  ['/bin/bash', '-c', jCmd],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE,
            });
            proc.init(null);
            this._fetchProc = proc;
            let reader = new Gio.DataInputStream({ base_stream: proc.get_stdout_pipe() });
            this._readLine(reader);
        } catch (e) {
            console.error('[DevSentry] fetch failed:', e);
        }
    }

    _readLine(reader) {
        if (this._cancelled) return;
        reader.read_line_async(GLib.PRIORITY_DEFAULT_IDLE, null, (stream, res) => {
            try {
                let [line] = stream.read_line_finish_utf8(res);
                if (line !== null) {
                    this._processLine(line);
                    this._readLine(reader);
                } else {
                    this._fetchProc = null;
                }
            } catch (_) {
                this._fetchProc = null;
            }
        });
    }

    _processLine(raw) {
        if (!raw) return;
        let line = raw.trim();
        if (!line || IGNORE_RE.test(line)) return;

        let uuid = this.getActiveUUID();
        const hasUuid = !uuid || line.includes(uuid);
        const isFrame = STACK_FRAME_RE.test(line);
        
        const partOfBlock = this._inErrorBlock && isFrame;
        
        if (!hasUuid && !partOfBlock) {
            this._inErrorBlock   = false;
            this._firstFrameDone = false;
            return;
        }

        if (this._seenLines.has(line)) return;
        this._seenLines.add(line);
        if (this._seenLines.size > 1000) this._seenLines.delete(this._seenLines.values().next().value);

        let type, display;

        if (line.includes('GNOME Shell-CRITICAL')) {
            if (line.includes('TypeError') || line.includes('JS ERROR')) {
                type    = LogType.ERROR;
                display = 'ERROR: ' + line.replace(/^GNOME Shell-CRITICAL \*\*:\s*/, '');
            } else {
                type    = LogType.CRITICAL;
                display = 'CRITICAL: ' + line.replace(/^GNOME Shell-CRITICAL \*\*:\s*/, '');
            }
            this._inErrorBlock   = true;
            this._firstFrameDone = false;

        } else if (CRIT_KEYS.some(k => line.includes(k))) {
            type    = LogType.CRITICAL;
            display = 'CRITICAL: ' + line.replace(/^Gjs-CRITICAL \*\*:\s*/, '');
            this._inErrorBlock   = true;
            this._firstFrameDone = false;

        } else if (isFrame && this._inErrorBlock && !this._firstFrameDone) {
            type    = LogType.SOURCE;
            display = 'FIX: ' + line; 
            this._firstFrameDone = true;

        } else if (isFrame && this._inErrorBlock) {
            type    = LogType.TRACE;
            display = 'TRACE: ' + line;

        } else if (ERROR_KEYS.some(k => line.includes(k)) && !isFrame) {
            type    = LogType.ERROR;
            display = (line.startsWith('ERROR:') || line.startsWith('JS ERROR')) ? line : 'ERROR: ' + line;
            this._inErrorBlock   = true;
            this._firstFrameDone = false;

        } else {
            if (line.includes('file://')) {
                type    = LogType.TRACE;
                display = 'TRACE: ' + line;
            } else {
                type    = LogType.TRACE;
                display = 'TRACE: ' + line;
            }
            this._inErrorBlock   = false;
            this._firstFrameDone = false;
        }

        this._history.push({ text: display, type });
        if (this._history.length > 500) this._history.shift();

        this._onLine(display, type);
    }
}