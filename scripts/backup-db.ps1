# ============================================================
# Sao lưu CSDL PostgreSQL (chạy trong Docker container hoadon-db)
#
# Chạy tay:      powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
# Chạy tự động:  xem scripts\dang-ky-backup-hang-ngay.ps1
#
# Kết quả: backups\hoadon_YYYY-MM-dd_HHmm.sql.gz
# Giữ lại 30 bản gần nhất, bản cũ hơn tự xóa.
#
# QUAN TRỌNG: Thư mục backups nên được đồng bộ ra nơi thứ hai
# (Google Drive / USB) — ổ cứng hỏng là mất toàn bộ dữ liệu!
# ============================================================
$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSScriptRoot
$backupDir  = Join-Path $projectDir "backups"
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

$stamp   = Get-Date -Format "yyyy-MM-dd_HHmm"
$outFile = Join-Path $backupDir "hoadon_$stamp.sql.gz"

# pg_dump bên trong container, nén gzip
docker exec hoadon-db sh -c "pg_dump -U hoadon web_xuat_hoa_don | gzip" > $outFile

if ((Get-Item $outFile).Length -lt 1024) {
    Remove-Item $outFile -Force -Confirm:$false
    throw "Backup that bai: file qua nho, kiem tra container hoadon-db co dang chay khong (docker ps)."
}

Write-Host "Da sao luu: $outFile ($([math]::Round((Get-Item $outFile).Length/1KB)) KB)"

# Xóa bản cũ, giữ 30 bản gần nhất
Get-ChildItem $backupDir -Filter "hoadon_*.sql.gz" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 30 |
    Remove-Item -Force -Confirm:$false
