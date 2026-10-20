param(
    [string]$SshAlias = 'nawat-server',
    [string]$Destination = (Join-Path (Split-Path -Parent $PSScriptRoot) 'local-backups\cloud'),
    [string]$RemoteSnapshot = '',
    [ValidateRange(1,365)][int]$Keep = 30
)
$ErrorActionPreference = 'Stop'
if ($SshAlias -notmatch '^[a-zA-Z0-9_.-]+$') { throw 'Invalid SSH alias' }
if (!$RemoteSnapshot) {
    $RemoteSnapshot = (& ssh -o BatchMode=yes -o ConnectTimeout=15 $SshAlias "find /var/backups/sultan-production -mindepth 2 -maxdepth 2 -type f -name VERIFIED -printf '%h\n' | sort | tail -1").Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not locate a verified server snapshot' }
}
$pattern = '^sultan-\d{4}-\d\d-\d\dT[0-9TZ-]+-[A-Za-z0-9]+$'
$name = ($RemoteSnapshot -split '/')[-1]
if ($RemoteSnapshot -ne "/var/backups/sultan-production/$name" -or $name -notmatch $pattern) { throw 'Unexpected remote snapshot path' }
$root = [IO.Path]::GetFullPath($Destination).TrimEnd([IO.Path]::DirectorySeparatorChar)
New-Item -ItemType Directory -Force -Path $root | Out-Null
$target = Join-Path $root $name
function Test-Snapshot([string]$Directory) {
    try {
        if (!(Test-Path -LiteralPath (Join-Path $Directory 'VERIFIED'))) { return $false }
        $manifest = Get-Content -LiteralPath (Join-Path $Directory 'manifest.json') -Raw | ConvertFrom-Json
        if ($manifest.format -ne 'sultan-cloud-v1') { return $false }
        foreach ($part in @(@('database','database.dump.aesgcm'),@('images','order-images.tar.gz.aesgcm'))) {
            $metadata = $manifest.($part[0])
            if ($metadata.file -ne $part[1] -or $metadata.sha256 -notmatch '^[a-f0-9]{64}$') { return $false }
            if ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $Directory $part[1])).Hash.ToLowerInvariant() -ne $metadata.sha256) { return $false }
        }
        return $true
    } catch { return $false }
}
if (!(Test-Snapshot $target)) {
    if (Test-Path -LiteralPath $target) { throw 'An existing local snapshot is invalid; inspect it before replacement' }
    $stage = Join-Path $root ('.partial-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage | Out-Null
    foreach ($file in @('manifest.json','database.dump.aesgcm','order-images.tar.gz.aesgcm','VERIFIED')) {
        $info = [Diagnostics.ProcessStartInfo]::new()
        $info.FileName = 'ssh.exe'
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        foreach ($arg in @('-o','BatchMode=yes','-o','IPQoS=none','-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3',$SshAlias,'cat',"$RemoteSnapshot/$file")) { $info.ArgumentList.Add($arg) }
        $process = [Diagnostics.Process]::Start($info)
        $errorTask = $process.StandardError.ReadToEndAsync()
        $stream = [IO.File]::Open((Join-Path $stage $file),[IO.FileMode]::CreateNew)
        try {
            $transfer = $process.StandardOutput.BaseStream.CopyToAsync($stream)
            if (!$transfer.Wait([TimeSpan]::FromMinutes(20))) { $process.Kill($true); throw 'Encrypted snapshot transfer timed out' }
            $null = $transfer.GetAwaiter().GetResult()
            $process.WaitForExit()
            $null = $errorTask.GetAwaiter().GetResult()
            if ($process.ExitCode -ne 0) { throw 'Encrypted snapshot transfer failed' }
        } finally { $stream.Dispose(); $process.Dispose() }
    }
    if (!(Test-Snapshot $stage)) { throw 'Transferred snapshot checksums did not match; partial files were retained for inspection' }
    if (![IO.Path]::GetFullPath($stage).StartsWith($root + [IO.Path]::DirectorySeparatorChar) -or ![IO.Path]::GetFullPath($target).StartsWith($root + [IO.Path]::DirectorySeparatorChar)) { throw 'Unexpected snapshot move path' }
    [IO.Directory]::Move($stage,$target)
}
$snapshots = @(Get-ChildItem -LiteralPath $root -Directory | Where-Object { $_.Name -match $pattern -and !($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -and (Test-Path -LiteralPath (Join-Path $_.FullName 'VERIFIED')) } | Sort-Object Name -Descending)
foreach ($expired in ($snapshots | Select-Object -Skip $Keep)) {
    $absolute = [IO.Path]::GetFullPath($expired.FullName)
    if (!$absolute.StartsWith($root + [IO.Path]::DirectorySeparatorChar) -or [IO.Path]::GetDirectoryName($absolute) -ne $root) { throw 'Unexpected retention path' }
    if (Test-Snapshot $absolute) { Remove-Item -LiteralPath $absolute -Recurse -Force }
}
[pscustomobject]@{ Snapshot=$target; TransferChecksumsVerified=$true; RetainedSnapshots=[Math]::Min($snapshots.Count,$Keep); EncryptionKeyCopied=$false }
