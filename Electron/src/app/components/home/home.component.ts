import { Component, ChangeDetectionStrategy, AfterViewInit, HostListener } from '@angular/core';
import { Observable, combineLatest, Subject } from 'rxjs';
import { map, share } from 'rxjs/operators';
import { EventLogService, State } from '../../providers/eventlog.service';

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
  sortProperty: 'Time';
  sortAscending: true;

  constructor(private eventLogService: EventLogService) {
    this.renderOffset = 0;
    this.state$ = this.eventLogService.state$;
    this.wheelMovement = new Subject();
    this.lastWheelMove = null;
    this.columnWidths = {
      'Time': 165,
      'Id': 50,
      'Machine': 60,
      'Level': 150,
      'Provider': 250
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
  }

  onMouseDown(evt: any) {
    const colName = evt.currentTarget.previousSibling.childNodes[0].nodeValue;
    this.dragData = { mouseX: evt.clientX, column: colName };
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(evt: MouseEvent) {
    if (this.dragData != null) {
      const difference = this.dragData.mouseX - evt.clientX;
      let width = this.columnWidths[this.dragData.column] - difference;
      if (width < 10) { width = 10; }
      this.columnWidths[this.dragData.column] = width;
      this.dragData.mouseX = evt.clientX;
    }
  }

  @HostListener('window:mouseup')
  onMouseUp() {
    this.dragData = null;
  }

  onScrollbar(newPosition: number) {
    this.renderOffset = newPosition;
    this.wheelMovement.next(null);
  }

  onWheel(evt: WheelEvent) {
    this.wheelMovement.next(evt);
  }

}
