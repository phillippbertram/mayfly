# Installation and first launch

Public stable installers are not available yet. These instructions prepare the
first test packages; clean-machine, platform, and phone acceptance remain open
in [#16](https://github.com/phillippbertram/mayfly/issues/16).

## Signing warning

**Current test packages do not have a verified publisher signature.** macOS
bundles are ad-hoc signed to seal their contents, but have no Apple Developer ID
signature or notarization. Windows installers are unsigned. Expect an unidentified
developer or SmartScreen warning; ad-hoc signing does not identify the publisher.
Signing and notarization remain tracked in [#14](https://github.com/phillippbertram/mayfly/issues/14).

Download only from the Mayfly release linked by the project's website or repository.
Compare the exact asset's SHA-256 with `SHA256SUMS` before opening it. A matching
checksum detects corruption; it does not replace a publisher signature. Continue
through an exception only if you trust the source. Managed devices may refuse
exceptions; use your organization's approved installation route in that case.

## macOS

1. Choose the `.dmg` for **Apple Silicon** or **Intel** to match your Mac.
2. Verify the download with `shasum -a 256 "/path/to/Mayfly-<version>-<target>.dmg"`.
3. Open the disk image and drag **Mayfly.app** into **Applications**. Eject the image.
4. Open **Mayfly** from Applications once. Recent macOS versions show **“Mayfly”
   Not Opened** because Apple could not verify the app; older versions say that the
   developer cannot be verified. Select **Done** to dismiss that first warning.
5. Open **System Settings → Privacy & Security**. Scroll to the Security section
   and select **Open Anyway** next to **“Mayfly” was blocked to protect your Mac.**
6. Confirm **Open** and authenticate if requested. This creates an exception for
   this app; subsequent launches normally use the usual application shortcut.

<!-- Absolute URLs: this file also ships as INSTALLATION.md with each release. -->
<p>
  <img src="https://phillippbertram.github.io/mayfly/screenshots/macos-not-opened.png" width="280" alt="macOS dialog titled “Mayfly” Not Opened, saying Apple could not verify that Mayfly is free of malware, with a Done button">
  <img src="https://phillippbertram.github.io/mayfly/screenshots/macos-open-anyway.png" width="420" alt="Privacy &amp; Security settings with the message “Mayfly” was blocked to protect your Mac and an Open Anyway button">
</p>

Older macOS versions call System Settings **System Preferences** and may place the
exception in **Security & Privacy → General**. If the button is missing, try opening
the installed app again first. The wording depends on the macOS version and device policy.
See [Apple's instructions for opening an unidentified app](https://support.apple.com/en-us/102445).

An alert that the app **will damage your computer**, a failed checksum, or a
**damaged** app is not the expected unidentified-developer prompt. Stop, download
again from the release, and report a reproducible failure. Do not disable
Gatekeeper globally or strip quarantine attributes to work around these errors.

## Windows

1. Choose the Windows x64 NSIS `.exe` installer.
2. In PowerShell, run `Get-FileHash -Algorithm SHA256 'C:\path\to\Mayfly-<version>-windows-x64.exe'`
   and compare the hash with the release's `SHA256SUMS` entry.
3. Open the installer. If Microsoft Defender SmartScreen displays **Windows
   protected your PC**, choose **More info**, then **Run anyway**, if available
   and you have verified and trust this download. The unsigned installer may show
   **Unknown publisher** in the permission prompt.
4. Follow the installer and open Mayfly from the Start menu.

Smart App Control or an organization's policy may block unsigned software without
offering **Run anyway**. Keep those protections enabled; request an approved build
or build from source. Do not override a malware detection. Microsoft's
[direct-distribution guidance](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/publish-first-app)
describes the first-run trust limitations of unsigned applications.

## Linux

Choose the x64 `.deb` for a supported Debian/Ubuntu system or `.AppImage` for a
compatible distribution. The build baseline is Ubuntu 22.04/Debian 12 or equivalent;
runtime acceptance on those systems remains pending. An AppImage is not a promise
of compatibility with every distribution.

Verify the exact download with `sha256sum "/path/to/Mayfly-<version>-linux-x64.<format>"`.
Then use your distribution's package installer for the `.deb`, or mark the
AppImage executable in the file manager and open it. From a terminal:

```sh
chmod u+x "/path/to/Mayfly-<version>-linux-x64.AppImage"
"/path/to/Mayfly-<version>-linux-x64.AppImage"
```

Replace the example paths/version/format with the actual asset; do not paste the
angle-bracket placeholders literally. These are checksum-verified test downloads,
not packages from a signed distribution repository. FUSE, WebKitGTK, and tray
requirements depend on the package and distribution; report missing prerequisites
instead of disabling operating-system protections.

## First share and notices

Keep both devices on the same trusted network, add a file, and open the share's
QR code or link on the receiving device. Allow Mayfly's local listener through
the firewall only on the intended trusted network. Local HTTP is unencrypted.
Closing the window normally keeps sharing active in the tray; **Quit Mayfly**
stops the server and invalidates its shares.

The installed app carries `LICENSE.txt`, `NOTICE.txt`, and
`THIRD_PARTY_NOTICES.txt` in its `licenses/` resource directory. On macOS, choose
**Show Package Contents** on Mayfly.app and open **Contents → Resources → licenses**.
On Windows, open `licenses` in the installation directory. Linux packages carry
it in the app's resource directory under `usr/lib`; see the repository's
[licensing process](https://github.com/phillippbertram/mayfly/blob/main/docs/licensing.md).
