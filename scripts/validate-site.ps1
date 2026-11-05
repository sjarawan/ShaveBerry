param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath $Root).Path
$failures = [System.Collections.Generic.List[string]]::new()
$files = [System.Collections.Generic.Dictionary[string, string]]::new([System.StringComparer]::Ordinal)
$anchors = [System.Collections.Generic.Dictionary[string, object]]::new([System.StringComparer]::Ordinal)
$sources = @(Get-ChildItem -LiteralPath $Root -Recurse -File | Where-Object {
    $_.FullName -notmatch '[\\/](\.git|node_modules)[\\/]'
})

foreach ($file in $sources) {
    $relative = $file.FullName.Substring($Root.Length).TrimStart([char[]]'\/').Replace('\', '/')
    $files[$relative] = $file.FullName
}
foreach ($required in @('index.html', 'game.html')) {
    if (-not $files.ContainsKey($required)) { $failures.Add("Missing required file: $required") }
}

# Match source attributes without introducing an HTML parser dependency.
$attributePattern = '(?is)(?<![\w:-])(?<name>href|src|poster|action|id|name)\s*=\s*(?:"(?<value>[^"]*)"|''(?<value>[^'']*)''|(?<value>[^\s>]+))'
$documents = @{}
foreach ($path in $files.Keys) {
    if ($path -notmatch '\.(html|css)$') { continue }
    $content = [System.IO.File]::ReadAllText($files[$path])
    $content = [regex]::Replace($content, '(?s)<!--.*?-->|/\*.*?\*/', '')
    if ($path -match '\.html$') {
        # Keep script opening tags (including src), but do not parse JS as markup.
        $content = [regex]::Replace($content, '(?is)(<script\b[^>]*>).*?</script\s*>', '$1</script>')
    }
    $documents[$path] = $content
    if ($path -notmatch '\.html$') { continue }
    $ids = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    foreach ($tag in [regex]::Matches($content, '(?s)<[A-Za-z][^>]*>')) {
        foreach ($attribute in [regex]::Matches($tag.Value, $attributePattern)) {
            $name = $attribute.Groups['name'].Value.ToLowerInvariant()
            if ($name -eq 'id' -or ($name -eq 'name' -and $tag.Value -match '^<a\s')) {
                [void]$ids.Add([System.Net.WebUtility]::HtmlDecode($attribute.Groups['value'].Value))
            }
        }
    }
    $anchors[$path] = $ids
}

$checked = 0
foreach ($path in $documents.Keys) {
    $content = $documents[$path]
    $references = [System.Collections.Generic.List[string]]::new()
    if ($path -match '\.html$') {
        foreach ($tag in [regex]::Matches($content, '(?s)<[A-Za-z][^>]*>')) {
            foreach ($attribute in [regex]::Matches($tag.Value, $attributePattern)) {
                if ($attribute.Groups['name'].Value -match '^(href|src|poster|action)$') {
                    $references.Add($attribute.Groups['value'].Value)
                }
            }
        }
    }
    foreach ($url in [regex]::Matches($content, '(?is)url\(\s*(?:"(?<url>[^"]*)"|''(?<url>[^'']*)''|(?<url>[^)\s]*))\s*\)')) {
        $references.Add($url.Groups['url'].Value)
    }
    foreach ($reference in $references) {
        $reference = [System.Net.WebUtility]::HtmlDecode($reference).Trim()
        if (-not $reference -or $reference -match '^(?:[a-z][a-z0-9+.-]*:|//)') { continue }
        $checked++
        $parts = $reference -split '#', 2
        $target = [uri]::UnescapeDataString(($parts[0] -split '\?', 2)[0])
        if (-not $target) {
            $targetPath = $files[$path]
        } elseif ($target.StartsWith('/')) {
            $targetPath = [System.IO.Path]::GetFullPath((Join-Path $Root $target.TrimStart('/')))
        } else {
            $targetPath = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $files[$path]) $target))
        }
        if (-not $targetPath.StartsWith($Root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -and $targetPath -ne $Root) {
            $failures.Add("${path}: reference escapes site root: $reference")
            continue
        }
        $key = $targetPath.Substring($Root.Length).TrimStart([char[]]'\/').Replace('\', '/')
        if (-not $files.ContainsKey($key)) {
            $indexKey = ($key.TrimEnd('/') + '/index.html').TrimStart('/')
            if ($files.ContainsKey($indexKey)) { $key = $indexKey }
            else {
                $failures.Add("${path}: missing local target (case-sensitive): $reference")
                continue
            }
        }
        if ($parts.Count -gt 1 -and $parts[1] -and $anchors.ContainsKey($key)) {
            $fragment = [uri]::UnescapeDataString($parts[1])
            if (-not $anchors[$key].Contains($fragment)) {
                $failures.Add("${path}: missing fragment in ${key}: #$fragment")
            }
        }
    }
}

if ($failures.Count) {
    foreach ($failure in $failures) { Write-Output "ERROR: $failure" }
    Write-Output "FAIL: $($failures.Count) issue(s); checked $checked local references."
    exit 1
}
Write-Output "PASS: required HTML files exist; checked $checked local references across $($documents.Count) HTML/CSS files."
exit 0
