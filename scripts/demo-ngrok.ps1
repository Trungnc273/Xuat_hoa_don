# ============================================================
# DEMO NHANH CHO KHÁCH XEM — public port 3000 ra Internet bằng ngrok
#
# Chạy:  powershell -ExecutionPolicy Bypass -File scripts\demo-ngrok.ps1
#
# ⚠️ LƯU Ý QUAN TRỌNG:
#  - Đây là cơ chế DEMO TẠM THỜI, không phải cách triển khai thật.
#    URL bản free đổi mỗi lần chạy; muốn chạy thật qua Internet → thuê VPS
#    (xem DANH-GIA-VA-LO-TRINH.md Mục 0b).
#  - Trong lúc ngrok chạy, BẤT KỲ AI có URL đều truy cập được trang login
#    → PHẢI đổi mật khẩu mặc định (admin123...) trước khi gửi link cho khách.
#  - Tắt demo: đóng cửa sổ ngrok (Ctrl+C).
# ============================================================
$ErrorActionPreference = "Stop"

# 1. Kiểm tra ngrok đã cài chưa
$ngrok = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrok) {
    Write-Host "Chua cai ngrok. Cach cai (chon 1):" -ForegroundColor Yellow
    Write-Host "  1. winget install ngrok.ngrok"
    Write-Host "  2. Tai tu https://ngrok.com/download roi giai nen vao thu muc trong PATH"
    Write-Host ""
    Write-Host "Sau khi cai, dang ky tai khoan free tai https://dashboard.ngrok.com"
    Write-Host "va chay 1 lan:  ngrok config add-authtoken <token-cua-ban>"
    exit 1
}

# 2. Kiểm tra app đang chạy ở port 3000
try {
    $null = Invoke-WebRequest -UseBasicParsing "http://localhost:3000/login" -TimeoutSec 5
} catch {
    Write-Host "App chua chay o port 3000!" -ForegroundColor Red
    Write-Host "Bat app truoc:  docker compose --profile prod up -d"
    exit 1
}

# 3. Nhắc bảo mật
Write-Host ""
Write-Host "=== SAP PUBLIC APP RA INTERNET ===" -ForegroundColor Yellow
Write-Host "Da doi mat khau mac dinh (admin123, manager123...) chua?"
Write-Host "Neu chua: vao http://localhost:3000/users (dang nhap admin) va dat lai mat khau truoc."
$confirm = Read-Host "Go 'ok' de tiep tuc"
if ($confirm -ne 'ok') { Write-Host "Da huy."; exit 0 }

# 4. Chạy ngrok — URL cong khai se hien trong bang 'Forwarding'
Write-Host ""
Write-Host "Dang mo tunnel... URL cong khai hien o dong 'Forwarding' ben duoi." -ForegroundColor Green
Write-Host "Gui URL do cho khach. Dong cua so nay (Ctrl+C) de tat demo."
Write-Host ""
ngrok http 3000
