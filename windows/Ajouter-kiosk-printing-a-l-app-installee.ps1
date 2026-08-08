# Ajoute --kiosk-printing au raccourci de l'application installée (Edge ou Chrome).
#
# Une application installée depuis le navigateur s'ouvre sans barre d'adresse, mais
# affiche quand même la boîte de dialogue d'impression : le drapeau ne s'applique qu'au
# processus lancé avec lui. Ce script le rajoute dans le raccourci, une fois pour toutes.
#
#   Clic droit sur ce fichier -> « Exécuter avec PowerShell »
#
# Pour revenir en arrière : relancer avec  -Retirer

param([switch]$Retirer)

$ErrorActionPreference = 'Stop'
$flag = '--kiosk-printing'

$dossiers = @(
  [Environment]::GetFolderPath('Desktop'),
  (Join-Path $env:AppData 'Microsoft\Windows\Start Menu\Programs'),
  (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs')
) | Where-Object { $_ -and (Test-Path $_) }

$shell = New-Object -ComObject WScript.Shell
$touches = 0

foreach ($dossier in $dossiers) {
  Get-ChildItem -Path $dossier -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $lnk = $shell.CreateShortcut($_.FullName)

    # On ne touche qu'aux raccourcis d'applications web (--app-id=) du POS.
    if ($lnk.Arguments -notmatch '--app-id=') { return }
    if ($_.Name -notmatch 'Caf|POS|Cafe') { return }

    if ($Retirer) {
      if ($lnk.Arguments -match [regex]::Escape($flag)) {
        $lnk.Arguments = ($lnk.Arguments -replace [regex]::Escape($flag), '').Trim() -replace '\s+', ' '
        $lnk.Save()
        Write-Host "Retire de : $($_.FullName)"
        $script:touches++
      }
      return
    }

    if ($lnk.Arguments -notmatch [regex]::Escape($flag)) {
      $lnk.Arguments = ($lnk.Arguments.Trim() + ' ' + $flag).Trim()
      $lnk.Save()
      Write-Host "Ajoute a : $($_.FullName)"
      $script:touches++
    } else {
      Write-Host "Deja present : $($_.FullName)"
    }
  }
}

if ($touches -eq 0) {
  Write-Host ''
  Write-Host "Aucun raccourci d'application POS trouve."
  Write-Host "Installez d'abord le POS depuis Edge (menu ... -> Applications -> Installer),"
  Write-Host "puis relancez ce script."
} else {
  Write-Host ''
  Write-Host 'Termine. Fermez completement la fenetre de l application, puis rouvrez-la'
  Write-Host 'par son raccourci pour que le changement prenne effet.'
}

Read-Host 'Appuyez sur Entree pour fermer'
