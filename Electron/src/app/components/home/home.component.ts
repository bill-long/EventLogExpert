import { Component, OnInit, NgZone } from '@angular/core';
import { Observable } from 'rxjs';
import { EventLogService, State } from '../../providers/eventlog.service';
import { DatabaseService } from '../../providers/database.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  stuff: string;
  state$: Observable<State>;
  rows: any[];
  renderBatchSize = 1000;
  renderDelay = 100;

  constructor(private eventLogService: EventLogService, private ngZone: NgZone, private dbService: DatabaseService) {
    this.state$ = this.eventLogService.state$;
    this.state$.subscribe(async (s: State) => {
      if (!s.openEventLogs || !s.openEventLogs.length) { return; }
      if (s.openEventLogs[0].records.length < this.renderBatchSize) { this.rows = s.openEventLogs[0].records; return; }
      const count = s.openEventLogs[0].records.length / this.renderBatchSize;
      this.rows = [];
      for (let i = 0; i < count; ++i) {
        this.rows.push(...s.openEventLogs[0].records.slice(i * this.renderBatchSize, i * this.renderBatchSize + this.renderBatchSize));
        await this.later(this.renderDelay);
      }
    });

    this.eventLogService.loadActiveLog('Application', null);
  }

  later(delay) {
    return new Promise(function(resolve) {
        setTimeout(resolve, delay);
    });
  }

  ngOnInit() {
  }
}
