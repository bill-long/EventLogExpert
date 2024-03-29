import { Menu, MenuItem, BrowserWindow, dialog, OpenDialogOptions, app, shell } from 'electron';
import { EventLogExpertWindowManager } from './eventlogexpert.windowmanager';
import * as isDev from 'electron-is-dev';
import * as url from 'url';
import * as path from 'path';
import * as log from 'electron-log';
import * as fs from 'fs';

export class EventLogExpertMenu {

  constructor(private windowManager: EventLogExpertWindowManager, private maxEventsPerWindow: number) {
    this.verifyDotnetPresent();
    this.createMenu();
  }

  private createMenu(): void {

    // Create the menu bar
    const menuBar = new Menu();

    // Add the menus
    menuBar.append(this.getFileMenu());
    menuBar.append(this.getEditMenu());
    // if (isDev) {
    menuBar.append(this.getViewMenu());
    // }

    // And finally set it on the app
    Menu.setApplicationMenu(menuBar);
  }

  private getEditMenu() {
    const editMenu = new Menu();
    editMenu.append(new MenuItem({ role: 'copy' }));

    if (isDev) {
      editMenu.append(new MenuItem({ role: 'paste' }));
      editMenu.append(new MenuItem({ role: 'pasteAndMatchStyle' }));
      editMenu.append(new MenuItem({ role: 'delete' }));
      editMenu.append(new MenuItem({ role: 'selectAll' }));
    }

    const edit = new MenuItem({ label: '&Edit', submenu: editMenu });
    return edit;
  }

  private getFileMenu() {

    const fileMenu = new Menu();
    fileMenu.append(new MenuItem({ label: 'Open Event Log File', click: (m, w, e) => this.openLogFromFile(m, w) }));
    fileMenu.append(new MenuItem({ label: 'Manage Providers', click: (m, w, e) => this.ingestProviders(m, w) }));
    const file = new MenuItem({ label: '&File', submenu: fileMenu });
    return file;
  }

  private getViewMenu() {

    const viewMenu = new Menu();

    viewMenu.append(new MenuItem({ role: 'reload' }));
    viewMenu.append(new MenuItem({ role: 'forceReload' }));
    viewMenu.append(new MenuItem({ role: 'toggleDevTools' }));
    viewMenu.append(new MenuItem({ type: 'separator' }));
    viewMenu.append(new MenuItem({ role: 'resetZoom' }));
    viewMenu.append(new MenuItem({ role: 'zoomIn' }));
    viewMenu.append(new MenuItem({ role: 'zoomOut' }));
    viewMenu.append(new MenuItem({ type: 'separator' }));
    viewMenu.append(new MenuItem({ role: 'togglefullscreen' }));

    const view = new MenuItem({ label: 'View', submenu: viewMenu });
    return view;
  }

  private ingestProviders(menuItem, window: BrowserWindow) {
    const ingestWindow = new BrowserWindow({
      modal: false,
      show: false,
      width: 1024,
      height: 768,
      autoHideMenuBar: true,
      webPreferences: {
        enableRemoteModule: true,
        nodeIntegration: true
      }
    });

    if (isDev) {
      ingestWindow.webContents.openDevTools();
    }

    // ingestWindow.setMenu(null);
    if (this.windowManager.isServing()) {
      require('electron-reload')(__dirname, {
        electron: require(`${__dirname}/node_modules/electron`)
      });
      ingestWindow.loadURL('http://localhost:4200/#/ingest');
    } else {
      ingestWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'dist/index.html'),
        protocol: 'file:',
        slashes: true,
        hash: '#/ingest'
      }));
    }
    ingestWindow.once('ready-to-show', () => ingestWindow.show());
  }

  private openLogFromFile(menuItem: MenuItem, window: BrowserWindow) {

    const options: OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Event Logs', extensions: ['evtx'] }
      ]
    };

    const files = dialog.showOpenDialog(window, options).then(files => {
      log.info("Open file dialog result", files);
      if (!files || files.canceled || files.filePaths.length < 1) { return; }

      if (!this.windowManager.hasOpenLog(window)) {
        this.windowManager.setOpenLog(window, files.filePaths[0]);
        window.webContents.send('openLogFromFile', { file: files.filePaths[0], start: 0, count: this.maxEventsPerWindow, tzName: null });
      } else {
        const newWindow = this.windowManager.createWindow(files.filePaths[0], 0, this.maxEventsPerWindow, null);
      }
    });
  }

  private verifyDotnetPresent() {
    const dotnetFolder = path.join(process.env.PROGRAMFILES, 'dotnet/shared/Microsoft.NETCore.App')
    fs.readdir(dotnetFolder, (err, files) => {
        if (!err) {
            let version5 = files.find(name => name.startsWith('5.'));
            if (version5) {
                return;
            }
        }

        const downloadUrl = 'https://dotnet.microsoft.com/download/dotnet/5.0/runtime';

        dialog.showMessageBoxSync(null, {
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

}
