import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';
import { map, scan, distinctUntilChanged } from 'rxjs/operators';
import { EventLogService, State } from '../../providers/eventlog.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {

  stuff: string;
  state$: Observable<State>;
  rows$: Observable<any[]>;

  constructor(private eventLogService: EventLogService) {
    this.state$ = this.eventLogService.state$;
    this.rows$ = this.state$.pipe(
      map(s => s.openEventLog ? s.openEventLog.records : []),
      scan((oldValue, newValue: any[]) => {
        if (oldValue.length < 1000 && newValue.length > oldValue.length) {
          return newValue.slice(0, 1000);
        } else {
          return oldValue;
        }
      }, []),
      distinctUntilChanged());
  }

  later(delay) {
    return new Promise(function (resolve) {
      setTimeout(resolve, delay);
    });
  }

}
