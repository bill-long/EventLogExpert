import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { EventLogExpertMenu } from './eventlogexpert.menu';
import { EventLogExpertWindowManager } from './eventlogexpert.windowmanager';
import * as log from 'electron-log';

let serve;
const args = process.argv.slice(1);
serve = args.some(val => val === '--serve');

const windowManager = new EventLogExpertWindowManager(serve);
const menuBar = new EventLogExpertMenu(windowManager);

try {

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      if (commandLine.length >= 2) {
        const newWindow = windowManager.createWindow(commandLine[1]);
      } else {
        windowManager.focus();
      }
    });

    app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', () => {
      if (process.argv.length >= 2) {
        windowManager.createWindow(process.argv[1]);
      } else {
        windowManager.createWindow(null);
      }
      autoUpdater.logger = log;
      log.transports.file.level = 'debug';
      autoUpdater.checkForUpdatesAndNotify();
    });

    // Quit when all windows are closed.
    app.on('window-all-closed', () => {
      // On OS X it is common for applications and their menu bar
      // to stay active until the user quits explicitly with Cmd + Q
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (windowManager.windowCount() === 0) {
        const win = windowManager.createWindow(null);
      }
    });
  }

} catch (e) {
  // Catch Error
  // throw e;
}
