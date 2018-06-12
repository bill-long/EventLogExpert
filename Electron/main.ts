import { app } from 'electron';
import { EventLogExpertMenu } from './eventlogexpert.menu';
import { EventLogExpertWindowManager } from './eventlogexpert.windowmanager';

let serve;
const args = process.argv.slice(1);
serve = args.some(val => val === '--serve');

const windowManager = new EventLogExpertWindowManager(serve);
const menuBar = new EventLogExpertMenu(windowManager);

try {

  const shouldQuit = app.makeSingleInstance(function (commandLine, workingDirectory) {
    // Someone tried to run a second instance, we should focus our window.
    windowManager.focus();
  });

  if (shouldQuit) {
    app.quit();
  }

  app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', () => { windowManager.createWindow(); });

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
      const win = windowManager.createWindow();
    }
  });

} catch (e) {
  // Catch Error
  // throw e;
}
