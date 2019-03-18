import { Component, OnInit, ViewEncapsulation, NgZone, isDevMode } from '@angular/core';
import { EventUtils, ProviderDetails } from '../../providers/eventutils.service';
import { DatabaseService } from '../../providers/database.service';
import { ElectronService } from '../../providers/electron.service';
import { FormGroup, AbstractControl, FormControl } from '@angular/forms';
import { Message, ProviderEvent, ProviderValueName } from '../../providers/database.models';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-ingest',
  templateUrl: './ingest.component.html',
  styleUrls: ['./ingest.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class IngestComponent implements OnInit {

  serverName: string;
  tagNames: string[];
  exportTag: string;
  status: string[];
  providerNames: string[];
  checkboxNames: string[];
  running: boolean;
  importServerTag: string;
  importFileName: string;
  exportFileName: string;
  importServerName: string;
  exportServerName: string;
  form: FormGroup;
  allSelected: boolean;
  lastWheelMove: number;
  activeTab: string;
  scrollTop = 0;

  constructor(
    private eventutils: EventUtils,
    private dbService: DatabaseService,
    private electronService: ElectronService,
    private ngZone: NgZone) {
  }

  ngOnInit() {
  }

  async exportLocalDatabase(fileName: string) {

    this.running = true;
    this.status = [];

    await this.electronService.fs.writeFile(fileName, '', err => {
      if (err) {
        this.status[1] = err.message;
        return;
      }
    });

    this.status.push('Writing messages...');
    let count = 0;
    this.dbService.getAllMessages$().subscribe(async m => {
      count += m.length;
      this.status[1] = `${count}`;
      await this.writeMessagesToFile(m, fileName);
    },
      err => this.status[2] = `${err}`,
      () => this.status[3] = 'Done!');
  }

  async exportSelectedProviders(serverName: string, fileName: string, tag: string) {

    this.running = true;
    this.status = [];

    const selectedProviderNames = this.providerNames.filter(n => this.form.controls[n].value);
    this.status.push(`Providers: ${selectedProviderNames.length} `);

    let messageCount = 0;
    let messages = [];
    this.status[1] = `Messages: ${messageCount}`;
    for (let i = 0; i < selectedProviderNames.length; i++) {
      this.status[2] = `Loading data for ${selectedProviderNames[i]}`;
      const results = await new Promise<any[]>(resolve => {
        this.eventutils.loadProviderDetails({
          serverName: serverName,
          providerName: selectedProviderNames[i],
          logFunc: s => { } // Logging causes the dev tools to crash for some reason
        }, (err, r) => { resolve(r); });
      });

      if (results && results.length > 0) {
        messageCount += results.length;
        this.status[1] = `Messages: ${messageCount}`;
        results.forEach(m => m.Tag = tag);
        messages = messages.concat(results);
      }
    }

    this.status[2] = 'Writing messages...';
    for (let i = 0; i < messages.length; i += 1000) {
      this.ngZone.run(() => this.status[3] = i.toString());
      await this.writeMessagesToFile(messages.slice(i, i + 1000), fileName);
    }

    this.ngZone.run(() => this.status[3] = 'Done!');
    this.running = false;
  }

  getMessagesFromFile(filename: string): Observable<any[]> {
    return new Observable(o => {
      const maxBuffer = 1000;
      let buffer = [];
      const readStream = this.electronService.fs.createReadStream(filename);
      const lineReader = this.electronService.readline.createInterface(readStream);
      lineReader.on('line', (line: string) => {
        console.log(line);
        if (line.startsWith(',')) {
          line = line.substr(1);
        }

        buffer.push(JSON.parse(line));
        if (buffer.length === maxBuffer) {
          o.next(buffer);
          buffer = [];
        }
      });
      lineReader.on('close', () => {
        if (buffer.length > 0) {
          o.next(buffer);
        }
        o.complete();
      });
    });
  }

  async getProvidersFromMachine(serverName: string) {

    this.running = true;

    this.status = [];

    const getNamesResult = await new Promise<{ names: string[], error: any }>(resolve =>
      this.eventutils.getProviderNames({ serverName: serverName }, (err, names: string[]) => resolve({ names: names, error: err })));

    if (getNamesResult.error) {
      this.status = [getNamesResult.error.toString()];
    } else {
      this.setFormNames(getNamesResult.names);
      this.providerNames = getNamesResult.names;
    }

    this.running = false;
  }

  getTagsFromFile(filename: string) {
    this.running = true;
    this.status = ['Reading file...'];
    let tagsInFile = [];
    let count = 0;
    this.getMessagesFromFile(filename).subscribe(messagesInFile => {
      this.ngZone.run(() => {
        count += messagesInFile.length;
        this.status[1] = `Messages: ${count}`;
        const tags = Array.from(new Set(messagesInFile.map(m => m.Tag)));
        tagsInFile = Array.from(new Set([...tagsInFile, ...tags])).sort();
      });
    },
      err => { },
      () => {
        this.ngZone.run(() => {
          this.setFormNames(tagsInFile);
          this.tagNames = tagsInFile;
          this.status.push('Done!');
          this.running = false;
        });
      });
  }

  async importSelectedProvidersFromServer(serverName: string, tag: string) {

    this.running = true;
    this.status = ['Checking tags..'];

    const existingTags = await this.dbService.getAllTags();
    if (existingTags.find(t => t.toLowerCase() === tag.toLowerCase())) {
      this.status = ['Tag already exists. Please enter a new tag name.'];
      this.running = false;
      return;
    } else {
      await this.dbService.addTag({ name: tag });
    }

    this.status = [];

    const selectedProviderNames = this.providerNames.filter(n => this.form.controls[n].value);
    this.status.push(`Providers: ${selectedProviderNames.length} `);

    let messageCount = 0;
    this.status[1] = `Messages: ${messageCount}`;
    let progressFunc = (count: number) => this.status[1] = `Messages: ${messageCount += count}`;
    let addMessagesFunc = async (items: Message[]) => await this.dbService.addMessages(items);
    let addEventsFunc = async (items: ProviderEvent[]) => await this.dbService.addEvents(items);
    let addKeywordsFunc = async (items: ProviderValueName[]) => await this.dbService.addKeywords(items);
    let addOpcodesFunc = async (items: ProviderValueName[]) => await this.dbService.addOpcodes(items);
    let addTasksFunc = async (items: ProviderValueName[]) => await this.dbService.addTasks(items);
    let logFunc = isDevMode() ? null : null;

    for (let i = 0; i < selectedProviderNames.length; i++) {
      this.status[2] = `Loading data for ${selectedProviderNames[i]}`;
      const results = await new Promise<ProviderDetails>(resolve => {
        this.eventutils.loadProviderDetails({
          serverName: serverName,
          providerName: selectedProviderNames[i],
          logFunc: logFunc
        }, (err, r) => {
          if (err) {
            console.log(`Error loading provider data for ${selectedProviderNames[i]}`, err);
            resolve(null);
          } else if (r.Result instanceof Error) {
            console.log(`Error loading provider data for ${selectedProviderNames[i]}`, r.Result);
            resolve(null);
          } else {
            resolve(r);
          }
        });
      });

      if (results) {
        await this.addItemsToDatabase(results.ProviderName, tag, results.Messages, progressFunc, addMessagesFunc);
        await this.addItemsToDatabase(results.ProviderName, tag, results.Events, progressFunc, addEventsFunc);
        await this.addItemsToDatabase(results.ProviderName, tag, results.Keywords, progressFunc, addKeywordsFunc);
        await this.addItemsToDatabase(results.ProviderName, tag, results.Opcodes, progressFunc, addOpcodesFunc);
        await this.addItemsToDatabase(results.ProviderName, tag, results.Tasks, progressFunc, addTasksFunc);
      }
    }

    this.status.push('Done!');
    this.running = false;

  }

  private async addItemsToDatabase(providerName: string, tag: string, items: any[], progress: (count: number) => void, add: (items: any[]) => Promise<void>) {
    if (items && items.length > 0) {
      items.forEach(i => { i.ProviderName = providerName.toUpperCase(); i.Tag = tag; })
      progress(items.length);
      await add(items);
    }
  }

  async importSelectedTagsFromFile(filename: string, tags: string[]) {

    this.running = true;
    this.status = ['Checking tags..'];

    let existingTags = await this.dbService.getAllTags();
    existingTags = existingTags.map(t => t.toLowerCase());
    const duplicateTags = tags.filter(t => existingTags.indexOf(t.toLowerCase()) > -1);
    if (duplicateTags.length > 0) {
      this.status = [`Tags already exist: ${duplicateTags}`];
      this.running = false;
      return;
    }

    const tagSet = new Set(tags);
    this.status = ['Reading file...'];
    let total = 0;
    let matching = 0;
    this.getMessagesFromFile(filename).subscribe(async messagesInFile => {
      const messagesMatchingTag = messagesInFile.filter(m => tagSet.has(m.Tag));
      total += messagesInFile.length;
      matching += messagesMatchingTag.length;
      this.ngZone.run(async () => {
        this.status[1] = `${total} total messages`;
        this.status[2] = `${matching} messages for selected tags`;
      });
      try {
        const addedCount = await this.dbService.addMessages(messagesMatchingTag);
      } catch (e) {
        this.ngZone.run(() => this.status[3] = e);
      }
    },
      err => this.ngZone.run(() => this.status[3] = err),
      () => {
        this.ngZone.run(() => this.status.push('Done!'));
      });
  }

  onScrollBar(newPosition: number) {
    this.scrollTop = newPosition;
  }

  onWheel(w: WheelEvent, div: HTMLElement) {
    if (w && (this.lastWheelMove === null || this.lastWheelMove !== w.timeStamp)) {
      this.lastWheelMove = w.timeStamp;
      if (w.deltaY > 0) {
        if (div.clientHeight + this.scrollTop < div.scrollHeight) {
          this.scrollTop += 100;
        }
      } else if (w.deltaY < 0) {
        this.scrollTop -= 100;
        if (this.scrollTop < 0) {
          this.scrollTop = 0;
        }
      }
    }
  }

  selectImportFile() {
    this.electronService
      .remote
      .dialog
      .showOpenDialog({ filters: [{ name: 'EventLogExpert Export File', extensions: ['json'] }] }, filenames => {
        if (filenames && filenames.length > 0) {
          this.ngZone.run(() => {
            this.importFileName = filenames[0];
          });
        }
      });
  }

  selectExportFile() {
    this.electronService.remote.dialog.showSaveDialog({}, filename => {
      this.ngZone.run(() => {
        this.exportFileName = filename;
      });
    });
  }

  setActiveTab(tabName: string) {
    this.activeTab = tabName;
    this.providerNames = null;
    this.tagNames = null;
    this.checkboxNames = null;
  }

  setFormNames(names: string[]) {
    const checkboxes: { [key: string]: AbstractControl } = {};
    names.forEach(n => checkboxes[`${n}`] = new FormControl(true));
    this.form = new FormGroup(checkboxes);
    this.checkboxNames = names;
    this.allSelected = true;
  }

  deselectAll() {
    this.allSelected = false;
    const controlNames = Object.getOwnPropertyNames(this.form.controls);
    controlNames.forEach(c => this.form.controls[c].setValue(false));
  }

  selectAll() {
    this.allSelected = true;
    const controlNames = Object.getOwnPropertyNames(this.form.controls);
    controlNames.forEach(c => this.form.controls[c].setValue(true));
  }

  private async writeMessagesToFile(m: any[], fileName: string) {
    const writeString = m.map(msg => JSON.stringify(msg)).join('\n') + '\n';
    await this.electronService.fs.appendFile(fileName, writeString, err => {
      if (err) {
        throw new Error(err.toString());
      }
    });
  }

}
