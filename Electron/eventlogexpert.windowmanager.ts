import { BrowserWindow, screen, app, ipcMain, dialog, shell } from 'electron';
import * as isDev from 'electron-is-dev';
import * as url from 'url';
import * as path from 'path';
import * as fs from 'fs';

export class EventLogExpertWindowManager {

    private openWindows: { window: BrowserWindow, openLog: string }[];

    constructor(private serve: boolean) {
        this.openWindows = [];
        ipcMain.on('openPartialEventLog', (ev, args) => {
            this.createWindow(args.file, args.start, args.count, args.tzName);
        });
    }

    public createWindow(log: string, start: number, count: number, tzName: string): BrowserWindow {
        const electronScreen = screen;
        const size = electronScreen.getPrimaryDisplay().workAreaSize;

        // Create the browser window.
        let win = new BrowserWindow({
            x: 0,
            y: 0,
            width: size.width,
            height: size.height,
            webPreferences: {
                enableRemoteModule: true,
                nodeIntegration: true
            }
        });

        if (this.serve) {
            require('electron-reload')(__dirname, {
                electron: require(`${__dirname}/node_modules/electron`)
            });
            win.loadURL('http://localhost:4200');
        } else {
            win.loadURL(url.format({
                pathname: path.join(__dirname, 'dist/index.html'),
                protocol: 'file:',
                slashes: true
            }));
        }

        if (isDev) {
            win.webContents.openDevTools();
        }

        // Emitted when the window is closed.
        win.on('closed', () => {

            // Remove from the array
            for (let i = 0; i < this.openWindows.length; i++) {
                if (this.openWindows[i].window === win) {
                    this.openWindows.splice(i, 1);
                    break;
                }
            }

            // Dereference the object
            win = null;
        });

        this.setWindowInfo(win, log);
        this.openWindows.push({ window: win, openLog: log });
        if (log) {
            win.webContents.once('dom-ready', () => {
                win.webContents.send('openLogFromFile', { file: log, start: start, count: count, tzName: tzName });
            });
        }
        return win;
    }

    public focus() {
        const win = this.openWindows[0].window;
        if (win) {
            if (win.isMinimized()) { win.restore(); }
            win.focus();
        }
    }

    public hasOpenLog(window: BrowserWindow) {
        const matches = this.openWindows.filter(l => l.window === window);
        return (matches[0].openLog !== null);
    }

    public setOpenLog(window: BrowserWindow, log: string) {
        this.setWindowInfo(window, log);
        const matches = this.openWindows.filter(l => l.window === window);
        matches[0].openLog = log;
    }

    private setWindowInfo(window: BrowserWindow, log: string) {
        window.setTitle(`EventLogExpert ${app.getVersion()} ${log ? log : ''}`);
        window.on('page-title-updated', e => e.preventDefault());
        this.verifyDotnetPresent(window);
    }

    private verifyDotnetPresent(window: BrowserWindow) {
        const dotnetFolder = path.join(process.env.PROGRAMFILES, 'dotnet/shared/Microsoft.NETCore.App')
        fs.readdir(dotnetFolder, (err, files) => {
            if (!err) {
                let version5 = files.find(name => name.startsWith('5.'));
                if (version5) {
                    return;
                }
            }

            const downloadUrl = 'https://dotnet.microsoft.com/download/dotnet/5.0/runtime';

            dialog.showMessageBoxSync(window, {
                type: 'error',
                buttons: ['OK'],
                title: '.NET 5 required',
                message: 'EventLogExpert now requires .NET 5. Please install the .NET 5.0 runtime. The console apps package is all that is needed: ' +
                downloadUrl + '. After you click OK, we will attempt to open the download URL.'
            });

            shell.openExternal(downloadUrl);

            app.exit(0);
        });
    }

    public windowCount() { return this.openWindows.length; }

    public isServing() { return this.serve; }
}
