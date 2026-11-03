## Signing and installation warning

These packages have no verified publisher signature. macOS builds use ad-hoc
signing and are not Developer ID signed or notarized; Windows installers are
unsigned. Expect macOS Gatekeeper or Windows SmartScreen warnings.

Verify the download against `SHA256SUMS`. On macOS, copy Mayfly to Applications,
try opening it once, then use **System Settings → Privacy & Security → Open Anyway**
and confirm **Open**. On Windows, an unrecognized-app SmartScreen dialog may offer
**More info → Run anyway**. Continue only for a verified download you trust.
Do not disable operating-system protections or override malware/damaged-app alerts.

Read the attached `INSTALLATION.md` for platform steps, prerequisites, and
limitations. `LICENSE.txt`, `NOTICE.txt`, and `THIRD_PARTY_NOTICES.txt` accompany
the packages and are also included in the app resources. Checksums establish
integrity, not publisher identity. Platform/device acceptance must be recorded
for this exact release before it is promoted as stable.
