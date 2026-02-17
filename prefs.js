import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class DevSentryPreferences extends ExtensionPreferences {

    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(620, 500);
        window.search_enabled = false;

        this._buildSettingsPage(window, settings);
        this._buildAboutPage(window);
    }

    _buildSettingsPage(window, settings) {
        const page = new Adw.PreferencesPage({
            title: 'Settings',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        this._buildProjectGroup(page, window, settings);
        this._buildBehaviorGroup(page, settings);
    }

    _buildProjectGroup(page, window, settings) {
        const group = new Adw.PreferencesGroup({
            title: 'Active Project',
            description: 'Dev Sentry will only show errors from this folder. Leave empty to monitor all GNOME Shell errors.',
        });
        page.add(group);

        const pathRow = new Adw.ActionRow({
            title: 'Project Folder',
            subtitle: 'Select your extension development folder',
        });

        const pathEntry = new Gtk.Entry({
            placeholder_text: '/home/user/.local/share/gnome-shell/extensions/my-extension@user',
            valign: Gtk.Align.CENTER,
            hexpand: true,
            width_chars: 30,
        });
        settings.bind('project-path', pathEntry, 'text', Gio.SettingsBindFlags.DEFAULT);

        const browseBtn = new Gtk.Button({
            icon_name: 'folder-open-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Browse folder',
            css_classes: ['flat', 'circular'],
        });
        browseBtn.connect('clicked', () => this._openFolderDialog(pathEntry, window));

        const clearBtn = new Gtk.Button({
            icon_name: 'edit-clear-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Clear path',
            css_classes: ['flat', 'circular'],
        });
        clearBtn.connect('clicked', () => settings.set_string('project-path', ''));

        pathRow.add_suffix(pathEntry);
        pathRow.add_suffix(browseBtn);
        pathRow.add_suffix(clearBtn);
        group.add(pathRow);

        const statusRow = new Adw.ActionRow({
            title: 'Active Filter',
            subtitle: 'Shows which project is currently being monitored',
            icon_name: 'funnel-symbolic',
        });

        const statusLabel = new Gtk.Label({
            valign: Gtk.Align.CENTER,
            ellipsize: 3,
            max_width_chars: 40,
        });

        const updateStatus = () => {
            let path = settings.get_string('project-path');
            if (path.trim()) {
                let uuid = path.replace(/\/+$/, '').split('/').pop();
                statusLabel.label = uuid;
                statusLabel.css_classes = ['success'];
            } else {
                statusLabel.label = 'Monitoring all errors (Filter OFF)';
                statusLabel.css_classes = ['dim-label'];
            }
        };
        updateStatus();
        settings.connect('changed::project-path', updateStatus);

        statusRow.add_suffix(statusLabel);
        group.add(statusRow);
    }

    _buildBehaviorGroup(page, settings) {
        const group = new Adw.PreferencesGroup({ title: 'Behavior' });
        page.add(group);

        const notifRow = new Adw.ActionRow({
            title: 'Show Notifications',
            subtitle: 'Show toasts when copying logs or launching tools',
            icon_name: 'preferences-system-notifications-symbolic',
        });
        const notifSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind('show-notifications', notifSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        notifRow.add_suffix(notifSwitch);
        notifRow.set_activatable_widget(notifSwitch);
        group.add(notifRow);
    }

    _buildAboutPage(window) {
        const page = new Adw.PreferencesPage({
            title: 'About',
            icon_name: 'help-about-symbolic',
        });
        window.add(page);

        this._buildAboutHero(page);
        this._buildAboutLinks(page, window);
        this._buildAboutFeatures(page);
        this._buildAboutAuthor(page);
        this._buildAboutDonations(page, window);
    }

    _buildAboutHero(page) {
        const group = new Adw.PreferencesGroup();
        page.add(group);

        const heroBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            halign: Gtk.Align.CENTER,
            margin_top: 24,
            margin_bottom: 12,
        });

        // const logo = new Gtk.Image({
        //     icon_name: 'utilities-terminal-symbolic',
        //     pixel_size: 96,
        // });
        // logo.set_css_classes(['accent']);
        // heroBox.append(logo);

        const logoFile = `${this.path}/icons/logo.png`;
        const logo = Gtk.Image.new_from_file(logoFile);
        logo.set_pixel_size(128);
        heroBox.append(logo);

        heroBox.append(new Gtk.Label({
            label: '<span size="xx-large" weight="bold">Dev Sentry</span>',
            use_markup: true,
            margin_top: 8,
        }));

        heroBox.append(new Gtk.Label({
            label: 'The ultimate debugging companion for GNOME Shell developers',
            css_classes: ['dim-label'],
            margin_bottom: 4,
            justify: Gtk.Justification.CENTER,
            wrap: true,
        }));

        heroBox.append(new Gtk.Label({
            label: 'Version 1.0  •  GPL-2.0-or-later',
            css_classes: ['dim-label', 'caption'],
        }));

        const row = new Adw.ActionRow();
        row.set_child(heroBox);
        group.add(row);
    }

    _buildAboutLinks(page, window) {
        const group = new Adw.PreferencesGroup({ title: 'Links' });
        page.add(group);

        const addLink = (title, subtitle, icon, url) => {
            const row = new Adw.ActionRow({ title, subtitle, icon_name: icon, activatable: true });
            row.add_suffix(new Gtk.Image({
                icon_name: 'adw-external-link-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['dim-label'],
            }));
            row.connect('activated', () => {
                try {
                    Gio.AppInfo.launch_default_for_uri(url, window.get_display().get_app_launch_context());
                } catch (e) {
                    try { imports.gi.GLib.spawn_command_line_async(`xdg-open ${url}`); } catch (_) {}
                }
            });
            group.add(row);
        };

        addLink('GitHub Repository', 'github.com/narkagni/dev-sentry',
            'system-software-install-symbolic', 'https://github.com/narkagni/dev-sentry');

        addLink('GNOME Extensions', 'extensions.gnome.org',
            'application-x-addon-symbolic', 'https://extensions.gnome.org/extension/dev-sentry');
    }

    _buildAboutFeatures(page) {
        const group = new Adw.PreferencesGroup({ title: 'Features' });
        page.add(group);

        const features = [
            { title: 'Real-time Log Streaming',   subtitle: 'Live journalctl stream with smart error parsing',                         icon: 'media-playback-start-symbolic' },
            { title: 'Click to Fix',               subtitle: 'Click any error line to open VS Code at the exact file and line',         icon: 'go-jump-symbolic' },
            { title: 'Nested Shell Launcher',      subtitle: 'Launch a nested GNOME Shell instantly — no logout needed',                icon: 'utilities-terminal-symbolic' },
            { title: 'Smart Project Filter',       subtitle: 'Focus only on your extension by setting a project folder path',           icon: 'funnel-symbolic' },
            { title: 'Color-coded Log Types',      subtitle: 'Red = Error  •  Orange = Critical  •  Teal = Fix  •  Blue = Trace',      icon: 'applications-graphics-symbolic' },
        ];

        for (let f of features) {
            group.add(new Adw.ActionRow({ title: f.title, subtitle: f.subtitle, icon_name: f.icon }));
        }
    }

    _buildAboutAuthor(page) {
        const group = new Adw.PreferencesGroup({ title: 'Credits' });
        page.add(group);

        group.add(new Adw.ActionRow({
            title: 'Narkagni',
            subtitle: 'Author &amp; Maintainer',
            icon_name: 'avatar-default-symbolic',
        }));

        group.add(new Adw.ActionRow({
            title: 'Disclaimer',
            subtitle: 'Not affiliated with GNOME, VS Code, or any other mentioned tool',
            icon_name: 'dialog-information-symbolic',
        }));
    }

    _buildAboutDonations(page, window) {
        const group = new Adw.PreferencesGroup({
            title: 'Support Development',
            description: 'If Dev Sentry saves you debugging time, consider buying me a coffee ☕',
        });
        page.add(group);

        const coffeeRow = new Adw.ActionRow({
            title: 'Buy Me a Coffee',
            subtitle: 'buymeacoffee.com/narkagni',
            icon_name: 'emoji-food-symbolic',
            activatable: true,
        });
        coffeeRow.add_suffix(new Gtk.Image({
            icon_name: 'adw-external-link-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['dim-label'],
        }));
        coffeeRow.connect('activated', () => {
            try {
                Gio.AppInfo.launch_default_for_uri('https://buymeacoffee.com/narkagni',
                    window.get_display().get_app_launch_context());
            } catch (e) {
                try { imports.gi.GLib.spawn_command_line_async('xdg-open https://buymeacoffee.com/narkagni'); } catch (_) {}
            }
        });
        group.add(coffeeRow);

        const addCrypto = (coin, icon, address) => {
            const short = address.length > 24
                ? address.substring(0, 12) + '…' + address.slice(-8)
                : address;

            const row = new Adw.ActionRow({ title: coin, subtitle: short, icon_name: icon });

            const copyBtn = new Gtk.Button({
                icon_name: 'edit-copy-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat', 'circular'],
                tooltip_text: `Copy ${coin} address`,
            });

            copyBtn.connect('clicked', () => {
                const provider = Gdk.ContentProvider.new_for_value(address);
                window.get_display().get_clipboard().set_content(provider);
                try { window.add_toast(new Adw.Toast({ title: `${coin} address copied!`, timeout: 2 })); } catch (_) {}
            });

            row.add_suffix(copyBtn);
            group.add(row);
        };

        addCrypto('Bitcoin (BTC)',  'security-high-symbolic',   'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
        addCrypto('Ethereum (ETH)', 'emblem-shared-symbolic',   '0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
        addCrypto('Monero (XMR)',   'security-medium-symbolic', '888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkRDZVNUR52n6BFHtGtYMkAjCmfSrFNHb7fBEESMHQHsAZJ8ckXZ2NKsRsm');
    }

    _openFolderDialog(entry, window) {
        const dialog = new Gtk.FileDialog({ title: 'Select Project Folder', modal: true });
        dialog.select_folder(window, null, (dlg, res) => {
            try {
                const file = dlg.select_folder_finish(res);
                if (file) entry.text = file.get_path();
            } catch (_) {}
        });
    }
}