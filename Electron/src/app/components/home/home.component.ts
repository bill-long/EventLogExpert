import { Component, ChangeDetectionStrategy, AfterViewInit, HostListener } from '@angular/core';
import { Observable, Subject, ReplaySubject } from 'rxjs';
import { EventLogService, State } from '../../providers/eventlog.service';
import { EventRecord } from '../../providers/eventlog.models';

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
  filterPaneExpanded = false;
  detailDividerDragData: { mouseY: number };
  detailHeight = 200;
  detailHeightChange$ = new Subject<number>();
  sortProperty: 'RecordId';
  sortAscending: false;
  lastFocusedEvent: EventRecord;
  focusedEvent$ = new ReplaySubject<EventRecord>(1);

  constructor(private eventLogService: EventLogService) {
    this.state$ = this.eventLogService.state$;
    this.focusedEvent$.next(null);
  }

  onDetailDividerMouseDown(evt: any) {
    this.detailDividerDragData = { mouseY: evt.clientY };
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(evt: MouseEvent) {
    if (this.detailDividerDragData != null) {
      const difference = this.detailDividerDragData.mouseY - evt.clientY;
      let height = this.detailHeight + difference;
      if (height < 200) { height = 200; }
      this.detailHeight = height;
      this.detailHeightChange$.next(height);
      this.detailDividerDragData.mouseY = evt.clientY;
    }
  }

  @HostListener('window:mouseup')
  onMouseUp() {
    this.detailDividerDragData = null;
  }
}
