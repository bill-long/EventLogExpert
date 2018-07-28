import { Component, OnInit, AfterViewInit, HostListener, ChangeDetectionStrategy, ElementRef } from '@angular/core';
import { EventRecord } from '../../providers/eventlog.models';
import { Subject, Observable, combineLatest } from 'rxjs';
import { EventLogService, State, FocusEventAction, SelectEventAction, ShiftSelectEventAction } from '../../providers/eventlog.service';
import { takeUntil, withLatestFrom } from 'rxjs/operators';

@Component({
  selector: 'app-event-table',
  templateUrl: './event-table.component.html',
  styleUrls: ['./event-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventTableComponent implements AfterViewInit, OnInit {

  renderOffset = 0;
  wheelMovement$ = new Subject<WheelEvent>();
  lastWheelMove: number = null;
  columnWidths: { [name: string]: number } = {
    'Record Id': 75,
    'Time': 165,
    'Id': 50,
    'Machine': 100,
    'Level': 100,
    'Source': 250,
    'Task Category': 150
  };
  columnDragData: { mouseX: number, column: string };
  state$: Observable<State>;
  visibleRecords$ = new Subject<EventRecord[]>();
  rowsInView: number;
  ngUnsubscribe = new Subject<void>();
  keyboardNavigation$ = new Subject<KeyboardEvent>();
  windowResize$ = new Subject<void>();
  elementHeight: number;

  constructor(private eventLogService: EventLogService, private ref: ElementRef) {
    this.state$ = this.eventLogService.state$;
    this.rowsInView = 1;
  }

  ngAfterViewInit() {
    this.wheelMovement$.next(null);
    this.windowResize$.next(null);
  }

  ngOnInit() {
    // In order to provide a good experience when the user loads up an event log with
    // hundreds of thousands of records, we manually handle the scrolling by changing
    // which items we render when the mouse wheel moves.
    combineLatest(this.state$, this.wheelMovement$, this.windowResize$)
      .pipe(
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe(
        (([s, w]) => {
          if (s.recordsFiltered.length > 0) {
            this.rowsInView = (this.ref.nativeElement.clientHeight / 19) - 2;
            let newRenderOffset = this.renderOffset;
            if (w && (this.lastWheelMove === null || this.lastWheelMove !== w.timeStamp)) {
              this.lastWheelMove = w.timeStamp;
              if (w.wheelDeltaY < 0 && this.renderOffset + this.rowsInView < s.recordsFiltered.length) {
                newRenderOffset += 5;
              } else if (w.wheelDeltaY > 0 && this.renderOffset > 0) {
                newRenderOffset -= 5;
              }
            }

            this.updateVisibleRecords(s, newRenderOffset);
          } else {
            this.updateVisibleRecords(s, 0);
          }
        }),
      );

    this.keyboardNavigation$
      .pipe(
        takeUntil(this.ngUnsubscribe),
        withLatestFrom(this.state$, this.visibleRecords$))
      .subscribe(([k, s, v]) => {
        if (s.focusedEvent) {
          let focusedEventIndex = v.indexOf(s.focusedEvent);
          this.rowsInView = (this.ref.nativeElement.clientHeight / 19) - 2;

          // If the focused event isn't visible, make it visible.
          if (focusedEventIndex === -1) {
            const newRenderOffset = s.recordsFiltered.indexOf(s.focusedEvent) - 5;
            this.renderOffset = newRenderOffset > 0 ? newRenderOffset : 0;
            v = s.recordsFiltered.slice(this.renderOffset, this.renderOffset + 100);
            focusedEventIndex = v.indexOf(s.focusedEvent);
          } else if (k.key === 'ArrowDown' && focusedEventIndex > this.rowsInView - 5) {
            const diff = focusedEventIndex - (this.rowsInView - 5);
            const newRenderOffset = Math.round(this.renderOffset + diff);
            this.renderOffset = newRenderOffset;
            v = s.recordsFiltered.slice(this.renderOffset, this.renderOffset + 100);
            focusedEventIndex = v.indexOf(s.focusedEvent);
          }

          // Now we can deal with the arrow key.
          if (k.key === 'ArrowUp' && focusedEventIndex > 0) {
            this.eventLogService.actions$.next(new FocusEventAction(v[focusedEventIndex - 1]));
            if (focusedEventIndex < 4 && this.renderOffset > 0) {
              const newRenderOffset = this.renderOffset - 1;
              this.updateVisibleRecords(s, newRenderOffset);
            }
          } else if (k.key === 'ArrowDown' && focusedEventIndex < v.length - 1) {
            this.eventLogService.actions$.next(new FocusEventAction(v[focusedEventIndex + 1]));
            if (focusedEventIndex > (v.length - 5) && this.renderOffset < s.records.length - 1) {
              const newRenderOffset = this.renderOffset + 1;
              this.updateVisibleRecords(s, newRenderOffset);
            }
          }
        }
      });
  }

  onMouseDown(evt: any) {
    const colName = evt.currentTarget.previousSibling.childNodes[0].nodeValue;
    this.columnDragData = { mouseX: evt.clientX, column: colName };
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      this.keyboardNavigation$.next(e);
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(evt: MouseEvent) {
    if (this.columnDragData != null) {
      const difference = this.columnDragData.mouseX - evt.clientX;
      let width = this.columnWidths[this.columnDragData.column] - difference;
      if (width < 10) { width = 10; }
      this.columnWidths[this.columnDragData.column] = width;
      this.columnDragData.mouseX = evt.clientX;
    }
  }

  @HostListener('window:mouseup')
  onMouseUp() {
    this.columnDragData = null;
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.windowResize$.next();
  }

  onScrollbar(newPosition: number) {
    this.renderOffset = newPosition;
    this.wheelMovement$.next(null);
  }

  onWheel(evt: WheelEvent) {
    this.wheelMovement$.next(evt);
  }

  selectEvent(r: EventRecord, event: MouseEvent) {
    if (event.button !== 0) { return; }
    if (event.ctrlKey) {
      this.eventLogService.actions$.next(new SelectEventAction(r));
    } else if (event.shiftKey) {
      this.eventLogService.actions$.next(new ShiftSelectEventAction(r));
    } else {
      this.setFocusedEvent(r);
    }
  }

  setFocusedEvent(evt: EventRecord) {
    this.eventLogService.actions$.next(new FocusEventAction(evt));
  }

  updateVisibleRecords(s: State, offset: number) {
    if (offset < 0) { offset = 0; }
    if (offset > s.recordsFiltered.length - 1) { offset = s.recordsFiltered.length - 10; }
    this.renderOffset = offset;
    this.visibleRecords$.next(s.recordsFiltered
      .slice(this.renderOffset, this.renderOffset + 100));
  }

}
