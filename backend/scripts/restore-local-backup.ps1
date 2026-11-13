[CmdletBinding()]
param(
  [string]$BackupPath = 'C:\temp\copa-leyendas.dump',
  [string]$EnvFile = '',
  [string]$PostgresBin = '',
  [switch]$Force,
  [switch]$SkipSafetyBackup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$restoreRepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if (-not $EnvFile) { $EnvFile = Join-Path $restoreRepoRoot 'backend\.env' }
$restoreEnvPath = [System.IO.Path]::GetFullPath($EnvFile)
$restoreBackupPath = [System.IO.Path]::GetFullPath($BackupPath)

function Read-RestoreEnv([string]$Path) {
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $values }
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') { continue }
    $key = $Matches[1]
    $value = $Matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$key] = $value
  }
  return $values
}

function Get-RestoreSetting([hashtable]$Values, [string]$Name, [string]$Default) {
  $processValue = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if ($processValue) { return $processValue }
  if ($Values.ContainsKey($Name) -and $Values[$Name]) { return [string]$Values[$Name] }
  return $Default
}

function Resolve-PostgresTool([string]$Name, [string]$BinDirectory) {
  if ($BinDirectory) {
    $candidate = Join-Path $BinDirectory "$Name.exe"
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
  }
  $command = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
  if (-not $command) { $command = Get-Command $Name -ErrorAction SilentlyContinue }
  if ($command) { return $command.Source }
  throw "No se encontro $Name. Agrega PostgreSQL al PATH o usa -PostgresBin 'C:\Program Files\PostgreSQL\18\bin'."
}

function Find-InstalledPostgresBin {
  $roots = @(
    (Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'PostgreSQL'),
    (Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'PostgreSQL')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container) }

  $candidates = foreach ($root in $roots) {
    foreach ($versionDirectory in Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue) {
      $bin = Join-Path $versionDirectory.FullName 'bin'
      if ((Test-Path -LiteralPath (Join-Path $bin 'pg_dump.exe') -PathType Leaf) -and
          (Test-Path -LiteralPath (Join-Path $bin 'pg_restore.exe') -PathType Leaf)) {
        $parsedVersion = 0
        [void][int]::TryParse($versionDirectory.Name, [ref]$parsedVersion)
        [pscustomobject]@{ Bin = $bin; Version = $parsedVersion }
      }
    }
  }
  return $candidates | Sort-Object Version -Descending | Select-Object -First 1 -ExpandProperty Bin
}

function Invoke-RestoreTool([string]$Tool, [string[]]$Arguments, [string]$FailureMessage) {
  & $Tool @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$FailureMessage (codigo $LASTEXITCODE)." }
}

if (-not (Test-Path -LiteralPath $restoreBackupPath -PathType Leaf)) {
  throw "No se encontro el backup: $restoreBackupPath"
}

$restoreEnv = Read-RestoreEnv $restoreEnvPath
$restoreDbHost = Get-RestoreSetting $restoreEnv 'DB_HOST' 'localhost'
$restoreDbPort = Get-RestoreSetting $restoreEnv 'DB_PORT' '5432'
$restoreDbUser = Get-RestoreSetting $restoreEnv 'DB_USER' 'postgres'
$restoreDbPassword = Get-RestoreSetting $restoreEnv 'DB_PASSWORD' 'postgres'
$restoreDbName = Get-RestoreSetting $restoreEnv 'DB_NAME' 'copa_leyendas'

if ($restoreDbHost -notin @('localhost', '127.0.0.1', '::1')) {
  throw "Proteccion activada: DB_HOST debe ser local y actualmente es '$restoreDbHost'."
}
if ($restoreDbName -notmatch '^[A-Za-z0-9_]+$' -or $restoreDbName -in @('postgres', 'template0', 'template1')) {
  throw "Nombre de base no permitido para restauracion: '$restoreDbName'."
}
if ($restoreDbPort -notmatch '^\d{1,5}$') { throw "DB_PORT invalido: '$restoreDbPort'." }

if (-not $PostgresBin) {
  $configuredDump = Get-RestoreSetting $restoreEnv 'PG_DUMP_BINARY' ''
  if ($configuredDump -and (Test-Path -LiteralPath $configuredDump -PathType Leaf)) {
    $PostgresBin = Split-Path -Parent $configuredDump
  }
}
if (-not $PostgresBin) { $PostgresBin = Find-InstalledPostgresBin }

$restorePgDump = Resolve-PostgresTool 'pg_dump' $PostgresBin
if (-not $PostgresBin) { $PostgresBin = Split-Path -Parent $restorePgDump }
$restorePgRestore = Resolve-PostgresTool 'pg_restore' $PostgresBin
$restoreDropDb = Resolve-PostgresTool 'dropdb' $PostgresBin
$restoreCreateDb = Resolve-PostgresTool 'createdb' $PostgresBin
$restoreNpm = (Get-Command 'npm.cmd' -ErrorAction Stop).Source

Write-Host ''
Write-Host 'Restauracion LOCAL de Copa Leyendas' -ForegroundColor Cyan
Write-Host "  Backup : $restoreBackupPath"
Write-Host "  Destino: $restoreDbUser@$restoreDbHost`:$restoreDbPort/$restoreDbName"
Write-Host "  Entorno: $restoreEnvPath"
Write-Host ''
Write-Warning 'Detene backend y frontend antes de continuar. La base indicada sera reemplazada por completo.'

if (-not $Force) {
  $restoreExpected = "RESTAURAR $restoreDbName"
  $restoreConfirmation = Read-Host "Escribi '$restoreExpected' para continuar"
  if ($restoreConfirmation -cne $restoreExpected) { throw 'Restauracion cancelada.' }
}

$restoreConnectionArgs = @('--host', $restoreDbHost, '--port', $restoreDbPort, '--username', $restoreDbUser)
$restorePreviousPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
[Environment]::SetEnvironmentVariable('PGPASSWORD', $restoreDbPassword, 'Process')

try {
  Write-Host 'Validando el archivo de backup...'
  & $restorePgRestore --list $restoreBackupPath | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'El archivo no es un backup valido o no es compatible con este pg_restore.' }

  if (-not $SkipSafetyBackup) {
    $restoreSafetyDir = Join-Path $restoreRepoRoot 'backend\storage\backups'
    New-Item -ItemType Directory -Force -Path $restoreSafetyDir | Out-Null
    $restoreTimestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $restoreSafetyPath = Join-Path $restoreSafetyDir "pre-restore-$restoreTimestamp.dump"
    Write-Host "Guardando copia recuperable de la base actual en $restoreSafetyPath..."
    Invoke-RestoreTool -Tool $restorePgDump -Arguments ($restoreConnectionArgs + @('--format=custom', '--no-owner', "--file=$restoreSafetyPath", $restoreDbName)) -FailureMessage 'No se pudo crear la copia de seguridad previa'
  }

  Write-Host "Eliminando la base local $restoreDbName..."
  Invoke-RestoreTool -Tool $restoreDropDb -Arguments ($restoreConnectionArgs + @('--if-exists', '--force', $restoreDbName)) -FailureMessage 'No se pudo eliminar la base local'

  Write-Host "Creando nuevamente la base $restoreDbName..."
  Invoke-RestoreTool -Tool $restoreCreateDb -Arguments ($restoreConnectionArgs + @('--owner', $restoreDbUser, $restoreDbName)) -FailureMessage 'No se pudo crear la base local'

  Write-Host 'Restaurando los datos...'
  Invoke-RestoreTool -Tool $restorePgRestore -Arguments ($restoreConnectionArgs + @('--dbname', $restoreDbName, '--exit-on-error', '--no-owner', '--no-privileges', $restoreBackupPath)) -FailureMessage 'Fallo la restauracion'

  Write-Host 'Aplicando migraciones pendientes del codigo actual...'
  $restorePreviousDbValues = @{}
  foreach ($restoreKey in @('DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME')) {
    $restorePreviousDbValues[$restoreKey] = [Environment]::GetEnvironmentVariable($restoreKey, 'Process')
  }
  [Environment]::SetEnvironmentVariable('DB_HOST', $restoreDbHost, 'Process')
  [Environment]::SetEnvironmentVariable('DB_PORT', $restoreDbPort, 'Process')
  [Environment]::SetEnvironmentVariable('DB_USER', $restoreDbUser, 'Process')
  [Environment]::SetEnvironmentVariable('DB_PASSWORD', $restoreDbPassword, 'Process')
  [Environment]::SetEnvironmentVariable('DB_NAME', $restoreDbName, 'Process')
  try {
    Push-Location $restoreRepoRoot
    & $restoreNpm --prefix backend run migration:run
    if ($LASTEXITCODE -ne 0) { throw "La base fue restaurada, pero fallaron las migraciones (codigo $LASTEXITCODE)." }
  } finally {
    Pop-Location
    foreach ($restoreKey in $restorePreviousDbValues.Keys) {
      [Environment]::SetEnvironmentVariable($restoreKey, $restorePreviousDbValues[$restoreKey], 'Process')
    }
  }

  Write-Host ''
  Write-Host 'Restauracion local terminada correctamente.' -ForegroundColor Green
  Write-Host 'Ya podes iniciar nuevamente backend y frontend.'
} finally {
  [Environment]::SetEnvironmentVariable('PGPASSWORD', $restorePreviousPassword, 'Process')
}
