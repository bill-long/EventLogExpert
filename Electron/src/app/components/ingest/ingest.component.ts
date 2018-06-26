import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { EventUtils } from '../../providers/eventutils.service';
import { DatabaseService } from '../../providers/database.service';

@Component({
  selector: 'app-ingest',
  templateUrl: './ingest.component.html',
  styleUrls: ['./ingest.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class IngestComponent implements OnInit {

  serverName: string;
  tag: string;
  status: string[];
  running: boolean;

  constructor(private eventutils: EventUtils, private dbService: DatabaseService) {
  }

  ngOnInit() {
  }

  async ingestAllProviders() {

    this.running = true;

    if (!this.tag) {
      this.tag = this.serverName;
    }

    this.status = ['Checking tags..'];

    const existingTags = await this.dbService.getAllTags();
    if (existingTags.find(t => t.toLowerCase() === this.tag.toLowerCase())) {
      this.status = ['Tag already exists. Please enter a new tag name.'];
      this.running = false;
      return;
    }

    this.status = [];

    const getNamesResult = await new Promise<{names: string[], error: any}>(resolve =>
      this.eventutils.getProviderNames({ serverName: this.serverName }, (err, names: string[]) => resolve({ names: names, error: err})));

    if (getNamesResult.error) {
      this.status = [getNamesResult.error.toString()];
      this.running = false;
      return;
    }

    const providerNames = getNamesResult.names;
    this.status.push(`Providers: ${providerNames.length} `);

    let messageCount = 0;
    let savedCount = 0;
    this.status[1] = `Messages: ${messageCount}`;
    for (let i = 0; i < providerNames.length; i++) {
      this.status[2] = `Loading data for ${providerNames[i]}`;
      const results = await new Promise<any[]>(resolve => {
        this.eventutils.loadProviderMessages({
          serverName: this.serverName,
          providerName: providerNames[i],
          logFunc: s => { } // Logging causes the dev tools to crash for some reason
        }, (err, r) => { resolve(r); });
      });

      if (results && results.length > 0) {
        messageCount += results.length;
        this.status[1] = `Messages: ${messageCount}`;
        results.forEach(m => m.Tag = this.tag);
        this.dbService.addMessages$(results).subscribe(
          r => { savedCount += r; },
          err => this.status[3] = `Error: ${err}`
        );
      }

      this.status[2] = `Saved ${savedCount}`;
    }

    this.status.push('Done!');
    this.running = false;

  }

}
