import { BrowserWindow, screen, app } from 'electron';
import * as isDev from 'electron-is-dev';
import * as url from 'url';
import * as path from 'path';

export class EventLogExpertWindowManager {

    private openWindows: { window: BrowserWindow, openLog: string }[];

    constructor(private serve: boolean) {
        this.openWindows = [];
    }

    public createWindow(log: string): BrowserWindow {
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
                win.webContents.send('openLogFromFile', log, null);
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
    }

    public windowCount() { return this.openWindows.length; }

    public isServing() { return this.serve; }
}
