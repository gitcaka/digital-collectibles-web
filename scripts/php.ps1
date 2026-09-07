param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $PhpArgs
)

$ErrorActionPreference = 'Stop'
$systemPhp = Get-Command php -ErrorAction SilentlyContinue

# Raise upload limits (defaults are 2M/8M, too small for up-to-8MB artwork uploads).
$UploadTuning = @(
    '-d', 'upload_max_filesize=16M',
    '-d', 'post_max_size=20M',
    '-d', 'max_file_uploads=20'
)

if ($systemPhp) {
    & $systemPhp.Source @UploadTuning @PhpArgs
    exit $LASTEXITCODE
}

$version = '8.4.25'
$archiveName = "php-$version-nts-Win32-vs17-x64.zip"
$expectedHash = '43a8f67ed2e5223fafb21293c85976361808855405278cef2cf3037c3ae2529c'
$runtimeRoot = Join-Path $env:LOCALAPPDATA "DigitalCollectibles\php-$version"
$phpExecutable = Join-Path $runtimeRoot 'php.exe'

if (-not (Test-Path -LiteralPath $phpExecutable)) {
    New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
    $archivePath = Join-Path ([System.IO.Path]::GetTempPath()) $archiveName
    Invoke-WebRequest -Uri "https://downloads.php.net/~windows/releases/$archiveName" -OutFile $archivePath
    $stream = [System.IO.File]::OpenRead($archivePath)
    try {
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        $actualHash = ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $stream.Dispose()
    }
    if ($actualHash -ne $expectedHash) {
        throw "PHP 下载文件校验失败：$actualHash"
    }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimeRoot -Force
}

$extensionDirectory = Join-Path $runtimeRoot 'ext'
& $phpExecutable `
    -d "extension_dir=$extensionDirectory" `
    -d extension=pdo_sqlite `
    -d extension=sqlite3 `
    -d extension=mbstring `
    @UploadTuning `
    @PhpArgs
exit $LASTEXITCODE
