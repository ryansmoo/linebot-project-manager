@echo off
echo ============================================
echo 🌐 正在連接到 Serveo.net 隧道服務
echo ============================================
echo.
echo 📋 連接資訊:
echo    本地端口: 3030
echo    服務類型: HTTP 隧道
echo.
echo ⚠️  第一次連接需要接受主機金鑰
echo    請輸入 'yes' 來接受連接
echo.
echo 🔗 連接成功後會顯示公網 URL
echo ============================================
echo.

ssh -o StrictHostKeyChecking=no -R 80:localhost:3030 serveo.net

pause