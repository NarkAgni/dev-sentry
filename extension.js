import { DevSentryPanel } from './devSentryPanel.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class DevSentryExtension extends Extension {
    enable() {
        this._panel = new DevSentryPanel(this.getSettings());
        Main.panel.addToStatusArea('dev-sentry', this._panel);
    }

    disable() {
        this._panel.destroy();
        this._panel = null;
    }
}