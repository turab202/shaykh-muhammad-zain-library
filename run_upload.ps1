# Keep uploading until all done - auto-restarts on crash
Set-Location "c:\Users\hasbi\Documents\GitHub\shaykh-muhammad-zain-library"

# Prevent screen/network sleep
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0
Write-Host "Sleep disabled. Starting upload loop..."

$round = 0
while ($true) {
    $round++
    Write-Host "=== Round $round | $(Get-Date -Format 'HH:mm:ss') ==="
    
    # Run the upload - will auto-skip failed files and continue
    py -X utf8 scripts/upload_to_archive.py --session 2
    
    # Check how many still need audio
    $remaining = py scripts/check_schema2.py 2>$null | Select-String "Lessons with audio" | ForEach-Object { $_.Line }
    Write-Host $remaining
    
    Write-Host "Restarting in 5s..."
    Start-Sleep -Seconds 5
}
