<div align="center">
  <img src="icons/logo.png" alt="Dev Sentry Logo" width="128" height="128">
  <h1>Dev Sentry</h1>
  <p><strong>The Ultimate Debugging Companion for GNOME Shell Extension Developers</strong></p>
  <p>Developed by <strong>Narkagni</strong></p>
</div>

<hr>

<h2>Overview</h2>
<p>
  Dev Sentry is a specialized GNOME Shell extension designed to streamline the workflow of extension developers. 
  It eliminates the need to constantly switch between terminals and the GUI by bringing logs, debugging tools, 
  and shell management directly into the top panel.
</p>

<h2>Gallery</h2>
<p>
  <strong>The Main Panel:</strong> Real-time log streaming with color-coded errors.
</p>
<div align="center">
  <img src="media/panel-preview.png" alt="Dev Sentry Panel Preview" width="100%" style="border-radius: 8px; border: 1px solid #333;">
</div>

<br>

<p>
  <strong>Nested Shell & Preferences:</strong> Launch a nested instance for safe testing and filter logs by project path.
</p>
<div align="center">
  <img src="media/nested-shell.png" alt="Nested Shell Launcher" width="48%" style="border-radius: 8px; border: 1px solid #333;">
  <img src="media/prefs.png" alt="Preferences Window" width="48%" style="border-radius: 8px; border: 1px solid #333;">
</div>

<hr>

<h2>Key Features</h2>

<details>
  <summary><strong>Real-Time Log Streaming</strong></summary>
  <p>
    Dev Sentry streams logs directly from <code>journalctl</code>. It explicitly filters out system noise and categorizes entries:
  </p>
  <ul>
    <li><strong>JS ERROR:</strong> Standard JavaScript errors in your code.</li>
    <li><strong>CRITICAL:</strong> Gjs and GNOME Shell critical warnings.</li>
    <li><strong>TRACE:</strong> Stack traces and custom log messages.</li>
  </ul>
</details>

<details>
  <summary><strong>One-Click "Fix" (VS Code Integration)</strong></summary>
  <p>
    When an error occurs, Dev Sentry parses the stack trace to find the file path and line number. 
    Clicking the error row in the panel immediately opens <strong>VS Code</strong> at the exact line 
    where the crash happened.
  </p>
</details>

<details>
  <summary><strong>Nested Shell Launcher</strong></summary>
  <p>
    Test your changes safely without logging out. The panel includes a dedicated button to launch a 
    <strong>Nested GNOME Shell</strong> instance within a window (Wayland supported). This allows for rapid 
    iteration cycles and prevents freezing your main user session.
  </p>
</details>

<details>
  <summary><strong>Smart Project Filtering</strong></summary>
  <p>
    Working on multiple extensions simultaneously? In the preferences, you can set your active 
    <strong>Project Folder</strong>. Dev Sentry will monitor the UUID of that folder and filter the 
    stream to show only logs and errors originating from that specific extension.
  </p>
</details>

<hr>

<h2>Installation</h2>

<h3>Requirements</h3>
<ul>
  <li>GNOME Shell 45 - 49</li>
  <li><code>libglib2.0-bin</code> (Required for schema compilation)</li>
  <li>VS Code (Recommended for the Click-to-Fix feature)</li>
</ul>

<h3>Install from Source</h3>

<p><strong>1. Clone the repository</strong></p>
<pre>
git clone https://github.com/NarkAgni/dev-sentry.git
cd dev-sentry
</pre>

<p><strong>2. Install using Make</strong></p>
<pre>
make install
</pre>

<p><strong>3. Restart GNOME Shell</strong></p>
<p>For X11: Press <code>Alt+F2</code>, type <code>r</code>, and hit Enter.<br>
For Wayland: Log out and log back in.</p>

<p><strong>4. Enable the extension</strong></p>
<pre>
gnome-extensions enable dev-sentry@narkagni
</pre>

<hr>

<h2>Support Development</h2>
<p>
  Dev Sentry is open-source and free. If this tool helps you debug faster and saves you time, 
  consider supporting the development.
</p>

<div align="center">
  <a href="https://github.com/sponsors/NarkAgni">
    <img src="https://img.shields.io/badge/Sponsor_on_GitHub-EA4AAA?style=for-the-badge&logo=github-sponsors" height="40">
  </a>
  &nbsp;&nbsp;
  <a href="https://buymeacoffee.com/narkagni">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40">
  </a>
</div>

<br>

<details>
  <summary><strong>Crypto Addresses</strong></summary>
  <br>
  <p><strong>Bitcoin (BTC):</strong></p>
  <pre>1GSHkxfhYjk1Qe4AQSHg3aRN2jg2GQWAcV</pre>

  <p><strong>Ethereum (ETH):</strong></p>
  <pre>0xf43c3f83e53495ea06676c0d9d4fc87ce627ffa3</pre>

  <p><strong>ThtherUS (USDT):</strong></p>
  <pre>THnqG9nchLgaf1LzGK3CqdmNpRxw59hs82</pre>
</details>

<hr>

<p align="center">
  License: GPL-3.0
