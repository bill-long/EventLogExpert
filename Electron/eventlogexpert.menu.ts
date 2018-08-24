import { Menu, MenuItem, BrowserWindow, dialog, OpenDialogOptions, app } from 'electron';
import { EventLogExpertWindowManager } from './eventlogexpert.windowmanager';
import * as isDev from 'electron-is-dev';
import * as url from 'url';
import * as path from 'path';

export class EventLogExpertMenu {

  constructor(private windowManager: EventLogExpertWindowManager) {
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
      editMenu.append(new MenuItem({ role: 'pasteandmatchstyle' }));
      editMenu.append(new MenuItem({ role: 'delete' }));
      editMenu.append(new MenuItem({ role: 'selectall' }));
    }

    const edit = new MenuItem({ label: '&Edit', submenu: editMenu });
    return edit;
  }

  private getFileMenu() {

    const fileMenu = new Menu();
    fileMenu.append(new MenuItem({ label: 'Open Event Log File', click: (m, w, e) => this.openLogFromFile(m, w, e) }));
    fileMenu.append(new MenuItem({ label: 'Manage Providers', click: (m, w, e) => this.ingestProviders(m, w, e) }));
    const file = new MenuItem({ label: '&File', submenu: fileMenu });
    return file;
  }

  private getViewMenu() {

    const viewMenu = new Menu();

    viewMenu.append(new MenuItem({ role: 'reload' }));
    viewMenu.append(new MenuItem({ role: 'forcereload' }));
    viewMenu.append(new MenuItem({ role: 'toggledevtools' }));
    viewMenu.append(new MenuItem({ role: 'separator' }));
    viewMenu.append(new MenuItem({ role: 'resetzoom' }));
    viewMenu.append(new MenuItem({ role: 'zoomin' }));
    viewMenu.append(new MenuItem({ role: 'zoomout' }));
    viewMenu.append(new MenuItem({ role: 'separator' }));
    viewMenu.append(new MenuItem({ role: 'togglefullscreen' }));

    const view = new MenuItem({ label: 'View', submenu: viewMenu });
    return view;
  }

  private ingestProviders(menuItem, window: BrowserWindow, ev: Event) {
    const ingestWindow = new BrowserWindow({ modal: false, show: false, width: 1024, height: 768, autoHideMenuBar: true });
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

  private openLogFromFile(menuItem: MenuItem, window: BrowserWindow, ev: Event) {

    const options: OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Event Logs', extensions: ['evtx'] }
      ]
    };

    const files = dialog.showOpenDialog(window, options);
    if (!files || !files.length) { return; }

    if (!this.windowManager.hasOpenLog(window)) {
      this.windowManager.setOpenLog(window, files[0]);
      window.webContents.send('openLogFromFile', files[0], null);
    } else {
      const newWindow = this.windowManager.createWindow(files[0]);
    }
  }

}
