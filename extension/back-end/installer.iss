; LinkHub SSH Server - Inno Setup 安装脚本
; 使用 Inno Setup 编译此脚本生成安装包
; 下载 Inno Setup: https://jrsoftware.org/isinfo.php

[Setup]
AppName=LinkHub SSH Server
AppVersion=1.0.0
AppPublisher=LinkHub
DefaultDirName={autopf}\LinkHubSSH
DefaultGroupName=LinkHub SSH
OutputBaseFilename=LinkHubSSH-Setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
UninstallDisplayIcon={app}\linkhub-ssh.exe

[Files]
Source: "linkhub-ssh.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\LinkHub SSH Server"; Filename: "{app}\linkhub-ssh.exe"
Name: "{group}\卸载 LinkHub SSH"; Filename: "{uninstallexe}"

[Run]
; 安装完成后立即启动（隐藏窗口）
Filename: "{app}\linkhub-ssh.exe"; Parameters: "-action run"; Flags: nowait runhidden postinstall

[Registry]
; 注册开机自启（当前用户）
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "LinkHubSSH"; ValueData: """{app}\linkhub-ssh.exe"" -action run"; Flags: uninsdeletevalue

[UninstallRun]
; 卸载时结束进程
Filename: "taskkill"; Parameters: "/F /IM linkhub-ssh.exe"; Flags: runhidden

[Code]
// 安装前先结束已运行的进程
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    Exec('taskkill', '/F /IM linkhub-ssh.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
