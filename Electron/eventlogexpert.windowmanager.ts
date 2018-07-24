import { BrowserWindow, screen } from 'electron';
import * as url from 'url';
import * as path from 'path';

export class EventLogExpertWindowManager {

    private openWindows: { window: BrowserWindow, openLog: string }[];

    constructor(private serve: boolean) {
        this.openWindows = [];
    }

    public createWindow(): BrowserWindow {
        const electronScreen = screen;
        const size = electronScreen.getPrimaryDisplay().workAreaSize;

        // Create the browser window.
        let win = new BrowserWindow({
            x: 0,
            y: 0,
            width: size.width,
            height: size.height
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

        this.openWindows.push({ window: win, openLog: null });
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
        console.log('Checking if window has open log');
        const matches = this.openWindows.filter(l => l.window === window);
        console.log('Found matches: ' + matches.length);
        console.log(matches[0]);
        return (matches[0].openLog !== null);
    }

    public setOpenLog(window: BrowserWindow, log: string) {
        console.log('Setting open log for window');
        const matches = this.openWindows.filter(l => l.window === window);
        console.log('Found matches: ' + matches.length);
        console.log(matches[0]);
        matches[0].openLog = log;
        console.log('Object after change:');
        console.log(matches[0]);
        console.log('Collection after change:');
        console.log(this.openWindows);
    }

    public windowCount() { return this.openWindows.length; }

    public isServing() { return this.serve; }
}
