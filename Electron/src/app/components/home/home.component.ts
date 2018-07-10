import { Component, ChangeDetectionStrategy, AfterViewInit, HostListener } from '@angular/core';
import { Observable, combineLatest, Subject, ReplaySubject } from 'rxjs';
import { map, share } from 'rxjs/operators';
import { EventLogService, State } from '../../providers/eventlog.service';
import { EventRecord } from '../../providers/eventlog.models';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements AfterViewInit {

  stuff: string;
  state$: Observable<State>;
  rows$: Observable<any[]>;
  filterPaneExpanded: true;
  renderOffset: number;
  wheelMovement: Subject<WheelEvent>;
  lastWheelMove: number;
  columnWidths: { [name: string]: number };
  dragData: { mouseX: number, column: string };
  detailDividerDragData: { mouseY: number };
  detailHeight = 200;
  detailHeightChange$ = new Subject<number>();
  sortProperty: 'Time';
  sortAscending: true;
  lastFocusedEvent: EventRecord;
  focusedEvent$ = new ReplaySubject<EventRecord>(1);

  constructor(private eventLogService: EventLogService) {
    this.renderOffset = 0;
    this.state$ = this.eventLogService.state$;
    this.wheelMovement = new Subject();
    this.lastWheelMove = null;
    this.columnWidths = {
      'Time': 165,
      'Id': 50,
      'Machine': 100,
      'Level': 100,
      'Source': 250,
      'Task Category': 150
    };

    // In order to provide a good experience when the user loads up an event log with
    // hundreds of thousands of records, we manually handle the scrolling by changing
    // which items we render when the mouse wheel moves.
    this.rows$ = combineLatest(this.state$, this.wheelMovement).pipe(
      map(([s, w]) => {
        if (s.records.length > 0) {
          if (w && (this.lastWheelMove === null || this.lastWheelMove !== w.timeStamp)) {
            this.lastWheelMove = w.timeStamp;
            if (w.wheelDeltaY < 0 && this.renderOffset < s.records.length - 10) {
              this.renderOffset += 5;
            } else if (w.wheelDeltaY > 0 && this.renderOffset > 0) {
              this.renderOffset -= 5;
            }
          }

          return s.records.slice(this.renderOffset, this.renderOffset + 100);
        }
      }),
      share());
  }

  ngAfterViewInit() {
    this.wheelMovement.next(null);
    this.focusedEvent$.next(null);
  }

  onMouseDown(evt: any) {
    const colName = evt.currentTarget.previousSibling.childNodes[0].nodeValue;
    this.dragData = { mouseX: evt.clientX, column: colName };
  }

  onDetailDividerMouseDown(evt: any) {
    this.detailDividerDragData = { mouseY: evt.clientY };
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(evt: MouseEvent) {
    if (this.dragData != null) {
      const difference = this.dragData.mouseX - evt.clientX;
      let width = this.columnWidths[this.dragData.column] - difference;
      if (width < 10) { width = 10; }
      this.columnWidths[this.dragData.column] = width;
      this.dragData.mouseX = evt.clientX;
    } else if (this.detailDividerDragData != null) {
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
    this.dragData = null;
    this.detailDividerDragData = null;
  }

  onScrollbar(newPosition: number) {
    this.renderOffset = newPosition;
    this.wheelMovement.next(null);
  }

  onWheel(evt: WheelEvent) {
    this.wheelMovement.next(evt);
  }

  setFocusedEvent(evt: EventRecord) {
    if (this.lastFocusedEvent) {
      this.lastFocusedEvent.isFocused = false;
    }

    this.lastFocusedEvent = evt;
    evt.isFocused = true;
    this.focusedEvent$.next(evt);
  }

}
