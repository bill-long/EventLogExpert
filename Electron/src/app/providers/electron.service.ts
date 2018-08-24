import { Injectable } from '@angular/core';

// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.
import { ipcRenderer, webFrame, remote, clipboard } from 'electron';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as readline from 'readline';
import * as edge from 'electron-edge-js';

const electron = window.require('electron');

@Injectable()
export class ElectronService {

  ipcRenderer: typeof ipcRenderer;
  webFrame: typeof webFrame;
  remote: typeof remote;
  childProcess: typeof childProcess;
  fs: typeof fs;
  edge: typeof edge;
  clipboard: typeof clipboard;
  extraResourcesPath: string;
  readline: typeof readline;

  constructor() {
    // Conditional imports
    if (this.isElectron()) {
      this.ipcRenderer = window.require('electron').ipcRenderer;
      this.webFrame = window.require('electron').webFrame;
      this.remote = window.require('electron').remote;
      const appPath = this.remote.app.getAppPath();
      this.extraResourcesPath = appPath.endsWith('app.asar') ? appPath.substr(0, appPath.length - 8) : '';
      this.clipboard = window.require('electron').clipboard;

      this.childProcess = window.require('child_process');
      this.fs = window.require('fs');
      this.edge = window.require('electron-edge-js');
      this.readline = window.require('readline');
    }
  }

  isElectron = () => {
    return window && window.process && window.process.type;
  }

}
