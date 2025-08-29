@echo off
echo 正在檢查變更...
git status

echo.
echo 正在添加所有變更...
git add .

echo.
set /p commit_msg="請輸入提交訊息 (按 Enter 使用預設訊息): "
if "%commit_msg%"=="" set commit_msg=自動更新

echo.
echo 正在提交變更...
git commit -m "%commit_msg%"

echo.
echo 正在推送到 GitHub...
git push

echo.
echo 完成！所有變更已上傳到 GitHub。
pause