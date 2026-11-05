# Shave Berry

A static marketing website and the Berry Bounce browser game, currently hosted with GitHub
Pages. Agent guidance and the longer-term architecture are in [AGENTS.md](AGENTS.md).

## Local validation

From the repository root, using Windows PowerShell 5.1:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-site.ps1
```

With PowerShell 7 on Windows, macOS, or Linux:

```powershell
pwsh -NoProfile -File scripts/validate-site.ps1
```

No packages, network access, or installation are required if PowerShell is already
available. The script also accepts `-Root <directory>` for validating another copy.
It exits with code 0 on success and 1 on validation failures.
The Windows command bypasses execution policy for that process only; it does not
change the machine's policy. Omit the flag if your policy already permits scripts.

The check requires `index.html` and `game.html`. It scans HTML
`href`, `src`, `poster`, and `action` references and CSS `url(...)` references in
HTML and CSS files. Relative and root-relative paths must resolve with exact case;
directory links must contain `index.html`. Query strings are ignored, URL escapes
are decoded, and HTML fragment links must match an `id` or legacy named anchor.
Commented-out HTML and CSS are ignored. External URLs, protocol-relative URLs,
and non-file schemes such as `mailto:`, `tel:`, and `data:` are skipped.

This is a lightweight source check, not a complete HTML/CSS parser. It does not
check external availability, JavaScript-generated URLs, `srcset`, CSS imports,
browser behavior, visual appearance, or accessibility. Manually test affected
interactions in a browser; the games can be opened directly from their HTML files.

## Pull request validation

`.github/workflows/validate-site.yml` runs the same command for pull requests and
manual workflow dispatches. It has read-only repository permissions, requires no
secrets, and does not publish or deploy the website. Maintainers can make its
`Static website validation` job a required status check in branch protection.

GitHub Pages publishing settings and `CNAME` are unchanged. A merge into the Pages
publishing branch may publish automatically, so obtain human production approval
before such a merge.
