import { Component, OnInit, ViewEncapsulation, NgZone, isDevMode } from '@angular/core';
import { EventUtils, ProviderDetails } from '../../providers/eventutils.service';
import { DatabaseService } from '../../providers/database.service';
import { ElectronService } from '../../providers/electron.service';
import { FormGroup, AbstractControl, FormControl } from '@angular/forms';
import { Message, ProviderEvent, ProviderValueName } from '../../providers/database.models';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { OSProvidersService } from '../../providers/osproviders.service';

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
  public ignoreOSProviders = false;
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
  addMessagesFunc: (items: any[]) => Promise<void>;
  addEventsFunc: (items: any[]) => Promise<void>;
  addKeywordsFunc: (items: any[]) => Promise<void>;
  addOpcodesFunc: (items: any[]) => Promise<void>;
  addTasksFunc: (items: any[]) => Promise<void>;

  constructor(
    private osProvidersService: OSProvidersService,
    private eventutils: EventUtils,
    private dbService: DatabaseService,
    private electronService: ElectronService,
    private ngZone: NgZone) {
    this.addMessagesFunc = async (items: Message[]) => await this.dbService.addMessages(items);
    this.addEventsFunc = async (items: ProviderEvent[]) => await this.dbService.addEvents(items);
    this.addKeywordsFunc = async (items: ProviderValueName[]) => await this.dbService.addKeywords(items);
    this.addOpcodesFunc = async (items: ProviderValueName[]) => await this.dbService.addOpcodes(items);
    this.addTasksFunc = async (items: ProviderValueName[]) => await this.dbService.addTasks(items);
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
      await this.writeObjectToFile(m, fileName);
    },
      err => this.status[2] = `${err}`,
      () => this.status[3] = 'Done!');
  }

  async exportSelectedProviders(serverName: string, fileName: string, tag: string) {

    this.running = true;
    this.status = [];

    let selectedProviderNames = this.providerNames.filter(n => this.form.controls[n].value);
    if (this.ignoreOSProviders) {
      selectedProviderNames = selectedProviderNames.filter(p => !this.osProvidersService.providerNames.has(p.toUpperCase()));
    }
    this.status.push(`Providers: 0/${selectedProviderNames.length} `);

    let providerCount = 0;
    let errorCount = 0;
    for (let i = 0; i < selectedProviderNames.length; i++) {
      this.status[2] = `Loading data for ${selectedProviderNames[i]}`;
      const results = await new Promise<ProviderDetails>(resolve => {
        this.eventutils.loadProviderDetails({
          serverName: serverName,
          providerName: selectedProviderNames[i],
          logFunc: s => { } // Logging causes the dev tools to crash for some reason
        }, (err, r) => { resolve(r); });
      });

      if (results) {
        if ((results as any).Result instanceof Error) {
          this.status[0] = `Providers: ${providerCount += 1}/${selectedProviderNames.length}`;
          this.status[1] = `Errors: ${errorCount += 1}`;
          console.error(`Failed to load provider ${selectedProviderNames[i]}`, results);
        } else {
          (results as any).Tag = tag;
          this.status[0] = `Providers: ${providerCount += 1}/${selectedProviderNames.length}`;
          this.status[2] = 'Writing provider details to file...';
          await this.writeObjectToFile(results, fileName);
        }
      }
    }

    this.ngZone.run(() => this.status[3] = 'Done!');
    this.running = false;
  }

  getObjectsFromFile(filename: string): Observable<any[]> {
    return new Observable(o => {
      const maxBuffer = 1;
      let buffer = [];
      const readStream = this.electronService.fs.createReadStream(filename);
      const lineReader = this.electronService.readline.createInterface(readStream);
      lineReader.on('line', (line: string) => {
        /* if (line.startsWith(',')) {
          line = line.substr(1);
        } */

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
    this.getObjectsFromFile(filename).subscribe(objectsInFile => {
      this.ngZone.run(() => {
        count += objectsInFile.length;
        this.status[1] = `Providers: ${count}`;
        const tags = Array.from(new Set(objectsInFile.map(m => m.Tag)));
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
    await this.deleteTags([tag]);
    await this.dbService.addTag({ name: tag });

    this.status = [];

    let selectedProviderNames = this.providerNames.filter(n => this.form.controls[n].value);
    if (this.ignoreOSProviders) {
      selectedProviderNames = selectedProviderNames.filter(p => !this.osProvidersService.providerNames.has(p.toUpperCase()));
    }

    this.status.push(`Providers: ${selectedProviderNames.length} `);

    let providerCount = 0;
    this.status[1] = `Providers: ${providerCount}`;

    for (let i = 0; i < selectedProviderNames.length; i++) {
      this.status[2] = `Loading data for ${selectedProviderNames[i]}`;
      const results = await new Promise<ProviderDetails>(resolve => {
        this.eventutils.loadProviderDetails({
          serverName: serverName,
          providerName: selectedProviderNames[i],
          logFunc: null
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

      await this.addProviderDetailsToDatabase(results, tag);
    }

    this.status.push('Done!');
    this.running = false;

  }

  private async addProviderDetailsToDatabase(providerDetails: ProviderDetails, tag: string) {
    if (providerDetails) {
      if (!(this.dbService.tagsCache.find(t => t.toUpperCase() === tag.toUpperCase()))) {
        await this.dbService.addTag({ name: tag });
      }
      await this.addItemsToDatabase(providerDetails.ProviderName, tag, providerDetails.Messages, this.addMessagesFunc);
      await this.addItemsToDatabase(providerDetails.ProviderName, tag, providerDetails.Events, this.addEventsFunc);
      await this.addItemsToDatabase(providerDetails.ProviderName, tag, providerDetails.Keywords, this.addKeywordsFunc);
      await this.addItemsToDatabase(providerDetails.ProviderName, tag, providerDetails.Opcodes, this.addOpcodesFunc);
      await this.addItemsToDatabase(providerDetails.ProviderName, tag, providerDetails.Tasks, this.addTasksFunc);
    }
  }

  private async addItemsToDatabase(providerName: string, tag: string, items: any[], add: (items: any[]) => Promise<void>) {
    if (items && items.length > 0) {
      items.forEach(i => { i.ProviderName = providerName.toUpperCase(); i.Tag = tag; })
      await add(items);
    }
  }

  private async deleteTags(tags: string[]) {
    let existingTags = await this.dbService.getAllTags();
    existingTags = existingTags.map(t => t.toLowerCase());
    const duplicateTags = tags.filter(t => existingTags.indexOf(t.toLowerCase()) > -1);
    if (duplicateTags.length > 0) {
      for (const t of duplicateTags) {
        this.status = [`Deleting existing tag: ${t}`];
        await this.dbService.deleteTag({ name: t });
      }
    }
  }

  async importSelectedTagsFromFile(filename: string, tags: string[]) {

    this.running = true;
    this.status = ['Checking tags..'];
    await this.deleteTags(tags);
    const tagSet = new Set(tags);
    this.status = ['Reading file...'];
    let total = 0;
    let matching = 0;
    this.getObjectsFromFile(filename).pipe(
      // The async operation must happen inside of concatMap instead of subscribe, so that
      // we wait for the operation to complete before processing the next item. Otherwise,
      // we have multiple threads adding information to the database at the same time, and
      // disk continues to show high activity for minutes after we report done, while the
      // database tries to catch up.
      concatMap(async providersInFile => {
        if (this.ignoreOSProviders) {
          providersInFile = providersInFile.filter(p => !this.osProvidersService.providerNames.has(p.ProviderName.toUpperCase()));
        }
        const providersMatchingTag = providersInFile.filter(m => tagSet.has(m.Tag));
        total += providersInFile.length;
        matching += providersMatchingTag.length;
        this.ngZone.run(async () => {
          this.status[1] = `${total} total providers`;
          this.status[2] = `${matching} providers for selected tags`;
        });
        for (const p of providersMatchingTag) {
          try {
            await this.addProviderDetailsToDatabase(p, p.Tag);
          } catch (e) {
            this.ngZone.run(() => this.status[3] = e);
          }
        }
      })
    )
      .subscribe(() => { },
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
      .showOpenDialog(null, { filters: [{ name: 'EventLogExpert Export File', extensions: ['json'] }] })
      .then(returnValue => {
        if (returnValue.filePaths && returnValue.filePaths.length > 0) {
          this.ngZone.run(() => {
            this.importFileName = returnValue.filePaths[0];
          });
        }
      });
  }

  selectExportFile() {
    this.electronService.remote.dialog.showSaveDialog({})
      .then(retValue => {
        this.ngZone.run(() => {
          this.exportFileName = retValue.filePath;
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

  private async writeObjectToFile(m, fileName: string) {
    const writeString = JSON.stringify(m) + '\n';
    await this.electronService.fs.appendFile(fileName, writeString, err => {
      if (err) {
        throw new Error(err.toString());
      }
    });
  }

}
