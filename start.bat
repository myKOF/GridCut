@echo off
echo Starting GridCut Server on port 5600...
start http://127.0.0.1:5600
cmd /c npx -y http-server -p 5600 -a 127.0.0.1
pause