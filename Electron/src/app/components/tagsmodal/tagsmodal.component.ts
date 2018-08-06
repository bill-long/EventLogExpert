import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../../providers/database.service';
import { Observable } from 'rxjs';
import { ElectronService } from '../../providers/electron.service';
import { EventLogService, LoadLogFromFileAction } from '../../providers/eventlog.service';

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

  constructor(private dbService: DatabaseService, private electronSvc: ElectronService, private eventLogService: EventLogService) {
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
    if (this.onSave) {
      this.onSave();
      this.onSave = null;
      this.visible = false;
    }
  }

}
