# ============================================================
# Đăng ký backup tự động hằng ngày lúc 21:00 bằng Task Scheduler.
# Chạy MỘT LẦN với quyền Administrator:
#   powershell -ExecutionPolicy Bypass -File scripts\dang-ky-backup-hang-ngay.ps1
# ============================================================
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "backup-db.ps1"
$taskName   = "HoaDon-Backup-HangNgay"

$action  = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At 21:00
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description "Sao luu CSDL hoa don hang ngay" -Force

Write-Host "Da dang ky task '$taskName' — chay hang ngay 21:00 (neu may tat, se chay bu khi bat lai)."
Write-Host "Kiem tra: Get-ScheduledTask -TaskName $taskName"
