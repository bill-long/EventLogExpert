import { Menu, MenuItem, BrowserWindow, dialog, OpenDialogOptions } from 'electron';
import { EventLogExpertWindowManager } from './eventlogexpert.windowmanager';
import isDev = require('electron-is-dev');

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
    if (isDev) {
      menuBar.append(this.getViewMenu());
    }

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

    // Open Event Log submenu
    const openEventLogMenu = new Menu();
    openEventLogMenu.append(new MenuItem({ label: 'Application', click: (m, w, e) => this.openActiveLog(m, w, e) }));
    openEventLogMenu.append(new MenuItem({ label: 'System', click: (m, w, e) => this.openActiveLog(m, w, e) }));
    openEventLogMenu.append(new MenuItem({ label: 'From File', click: (m, w, e) => this.openLogFromFile(m, w, e) }));
    const openEventLog = new MenuItem({ label: 'Open Event Log', submenu: openEventLogMenu });
    fileMenu.append(openEventLog);

    fileMenu.append(new MenuItem({ label: 'Ingest Providers', click: (m, w, e) => this.ingestProviders(m, w, e) }));

    const file = new MenuItem({ label: '&File', submenu: fileMenu });
    return file;
  }

  private getViewMenu() {

    const viewMenu = new Menu();

    viewMenu.append(new MenuItem({ role: 'reload' }));
    viewMenu.append(new MenuItem({ role: 'forcereload' }));
    viewMenu.append(new MenuItem({ role: 'toggledevtools' }));
    viewMenu.append(new MenuItem({ role: 'separator' }));
    viewMenu.append(new MenuItem({ role: 'resetzoon' }));
    viewMenu.append(new MenuItem({ role: 'zoomin' }));
    viewMenu.append(new MenuItem({ role: 'zoomout' }));
    viewMenu.append(new MenuItem({ role: 'separator' }));
    viewMenu.append(new MenuItem({ role: 'togglefullscreen' }));

    const view = new MenuItem({ label: 'View', submenu: viewMenu });
    return view;
  }

  private ingestProviders(menuItem, window: BrowserWindow, ev: Event) {
    // TODO
  }

  private openActiveLog(menuItem: MenuItem, window: BrowserWindow, ev: Event) {

    if (!this.windowManager.hasOpenLog(window)) {
      this.windowManager.setOpenLog(window, menuItem.label);
      window.webContents.send('openActiveLog', menuItem.label, null);
    } else {
      const newWindow = this.windowManager.createWindow();
      newWindow.webContents.once('dom-ready', () => {
        newWindow.webContents.send('openActiveLog', menuItem.label, null);
        this.windowManager.setOpenLog(newWindow, menuItem.label);
      });
    }

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
      const newWindow = this.windowManager.createWindow();
      this.windowManager.setOpenLog(newWindow, files[0]);
      newWindow.webContents.once('dom-ready', () => {
        newWindow.webContents.send('openLogFromFile', files[0], null);
      });
    }

  }

}