import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../../providers/database.service';
import { Observable } from 'rxjs';
import { ElectronService } from '../../providers/electron.service';
import { EventLogService, LoadLogFromFileAction } from '../../providers/eventlog.service';
import * as moment from 'moment-timezone';

@Component({
  selector: 'app-tagsmodal',
  templateUrl: './tagsmodal.component.html',
  styleUrls: ['./tagsmodal.component.scss']
})
export class TagsmodalComponent implements OnInit {

  tags$: Observable<string[]>;
  displayedTags: string[];
  visible = false;
  onSave: Function;
  currentTimeZoneName: string = Intl.DateTimeFormat().resolvedOptions().timeZone;
  allTimeZoneNames: string[];

  constructor(private dbService: DatabaseService, private electronSvc: ElectronService, private eventLogService: EventLogService) {
    const foo = moment;
    const testDate = new Date();
    const supportedTimeZones: string[] = moment.tz.names().filter(t => {
      try {
        testDate.toLocaleString(navigator.language, { timeZone: t });
        return true;
      } catch (err) {
        return false;
      }
    });
    this.allTimeZoneNames = supportedTimeZones.sort((a, b) => {
      const aOffset = moment.tz(a).utcOffset();
      const bOffset = moment.tz(b).utcOffset();
      if (aOffset !== bOffset) { return aOffset - bOffset; }
      if (a < b) { return -1; }
      if (a > b) { return 1; }
      return 0;
    });

    // Add the offset in front of the name
    this.allTimeZoneNames = this.allTimeZoneNames.map(t => `${moment.tz(t).format('Z')} ${t}`);
    this.currentTimeZoneName = `${moment.tz(this.currentTimeZoneName).format('Z')} ${this.currentTimeZoneName}`;

    this.tags$ = dbService.tagsByPriority$;
    this.tags$.subscribe(t => this.displayedTags = [...t]);
    electronSvc.ipcRenderer.on('openLogFromFile',
    (ev, file) => {
      this.visible = true;
      this.onSave = () => this.eventLogService.actions$.next(new LoadLogFromFileAction(file));
    });
  }

  moveDown(tag: string) {
    const index = this.displayedTags.indexOf(tag);
    this.displayedTags.splice(index, 1);
    this.displayedTags.splice(index + 1, 0, tag);
  }

  moveUp(tag: string) {
    const index = this.displayedTags.indexOf(tag);
    this.displayedTags.splice(index, 1);
    this.displayedTags.splice(index - 1, 0, tag);
  }

  ngOnInit() {
  }

  save() {
    this.dbService.setTagPriority(this.displayedTags);
    this.eventLogService.setTimeZone(this.currentTimeZoneName.substr(this.currentTimeZoneName.indexOf(' ') + 1));
    if (this.onSave) {
      this.onSave();
      this.onSave = null;
      this.visible = false;
    }
  }

}
