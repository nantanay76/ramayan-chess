@echo off
title Ramayan Chess Server - keep this window open while playing
cd /d "C:\Users\USER\ramayan-chess"
echo.
echo   Starting Ramayan Chess...
echo   Your browser will open in a few seconds.
echo.
echo   KEEP THIS BLACK WINDOW OPEN while you play.
echo   Close it when you are done - that stops the game server.
echo.
start "" cmd /c "timeout /t 4 >nul & start http://localhost:5173"
npm run dev
