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
interactions in a browser alongside the automated browser suite below.

## Browser tests

Use Node.js 24 LTS (minimum 22) and npm. No website build step is required.
Install the locked development dependencies and Chromium, then run:

```sh
npm ci
npx playwright install chromium
npm run test:types
npm test
```

On Linux, use `npx playwright install --with-deps chromium` to install required
system libraries as well. Downloads need network access. On Windows, if
PowerShell blocks npm scripts, substitute `npm.cmd` and `npx.cmd`; no execution
policy change is necessary.

Playwright starts and stops `scripts/serve-site.mjs` on
`http://127.0.0.1:4173`. Keep that port free; an existing server is intentionally
not reused. Only public root HTML and image assets are served. Tests never use
the production website; external requests (including Google Fonts) are blocked.
The server is a local test helper, not a production server.

The TypeScript suite runs in desktop Chromium and mobile Chromium (Pixel 7
emulation). It checks both homepage entry points, navigation anchors and the game
link, keyboard access to the menu, carousel buttons/dots/wrapping/arrow keys,
mobile menu opening and closing, all eight images decoding, and the game start
screen/canvas/home link. Reduced motion is enabled to make interaction tests
deterministic; carousel autoplay and touch swipes are not covered.

`npm test` returns a nonzero exit code on failure, with no automatic retries.
`npm run test:report` opens the HTML report. Failed tests retain screenshots and
traces; view a trace with `npx playwright show-trace <path-to-trace.zip>`.
Generated reports, results, and dependencies are ignored by Git and by the static
validator. Browser tests do not replace manual desktop/mobile checks, full
accessibility review, or testing gameplay, sound, saved scores, real devices,
other browser engines, and external services. No manual browser pass is implied
by a successful automated run.

## Pull request validation

`.github/workflows/validate-site.yml` runs the static validator and Chromium tests
as separate jobs for pull requests and manual workflow dispatches. The browser
job also checks TypeScript and uploads the HTML report and failure evidence as
the `playwright-report` artifact for 14 days, including on test failure. Download
and extract the artifact to inspect the report and traces. It has read-only
repository permissions, requires no secrets, and does not publish or deploy the
website. Maintainers can require both `Static website validation` and
`Chromium browser tests` in branch protection.

GitHub Pages publishing settings and `CNAME` are unchanged. A merge into the Pages
publishing branch may publish automatically, so obtain human production approval
before such a merge.
