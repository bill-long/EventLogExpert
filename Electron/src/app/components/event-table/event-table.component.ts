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
  arrowKeyNavigation = new Subject<KeyboardEvent>();
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

    // For wheel movement, we don't care if the focused event is in view
    combineLatest(this.wheelMovement$)
      .pipe(
        takeUntil(this.ngUnsubscribe),
        withLatestFrom(this.state$)
      )
      .subscribe(
        (([[w], s]) => {
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

            this.updateVisibleRecords(s, newRenderOffset, false);
          } else {
            this.updateVisibleRecords(s, 0, false);
          }
        }),
    );

    // For window resize, update the rowsInView in case of another view change
    this.windowResize$
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(() => {
        this.rowsInView = (this.ref.nativeElement.clientHeight / 19) - 2;
      });

    // For arrow key navigation, we must bring the focused event into view
    this.arrowKeyNavigation
      .pipe(
        takeUntil(this.ngUnsubscribe),
        withLatestFrom(this.state$, this.visibleRecords$))
      .subscribe(([k, s, v]) => {
        // Only act if there is a focused event
        if (s.focusedEvent) {
          // If the focused event isn't visible, make it visible.
          let focusedEventIndex = v.indexOf(s.focusedEvent);
          if (focusedEventIndex < 0) {
            focusedEventIndex = this.updateVisibleRecords(s, this.renderOffset, true);
          }

          // Now we can deal with the arrow key.
          if (k.key === 'ArrowUp' && focusedEventIndex > 0) {
            this.eventLogService.actions$.next(new FocusEventAction(v[focusedEventIndex - 1]));
          } else if (k.key === 'ArrowDown' && focusedEventIndex < v.length - 1) {
            this.eventLogService.actions$.next(new FocusEventAction(v[focusedEventIndex + 1]));
          }
        }
      });

    // For state changes (records filtered, sorted, etc), bring focused event into view
    this.state$
      .pipe(
        takeUntil(this.ngUnsubscribe),
        withLatestFrom(this.visibleRecords$)
      )
      .subscribe(([s, v]) => {
        this.updateVisibleRecords(s, this.renderOffset, true);
      });
  }

  onMouseDown(evt: any) {
    const colName = evt.currentTarget.previousSibling.childNodes[0].nodeValue;
    this.columnDragData = { mouseX: evt.clientX, column: colName };
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      this.arrowKeyNavigation.next(e);
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

  updateVisibleRecords(s: State, offset: number, ensureFocusedVisible: boolean) {
    if (offset < 0) { offset = 0; }
    if (offset > s.recordsFiltered.length - 1) { offset = s.recordsFiltered.length - 10; }
    this.renderOffset = offset;
    let newSlice = s.recordsFiltered
      .slice(this.renderOffset, this.renderOffset + 100);
    if (!ensureFocusedVisible || !s.focusedEvent) {
      // Go ahead and finish
      this.visibleRecords$.next(newSlice);
      return null;
    }

    // Otherwise, more work to do
    let focusedEventIndex = newSlice.indexOf(s.focusedEvent);
    if (focusedEventIndex === -1) {
      const centerPosition = Math.floor(this.rowsInView / 2);
      const newRenderOffset = s.recordsFiltered.indexOf(s.focusedEvent) - centerPosition;
      this.renderOffset = newRenderOffset > 0 ? newRenderOffset : 0;
      newSlice = s.recordsFiltered.slice(this.renderOffset, this.renderOffset + 100);
    }
    else if (focusedEventIndex > this.rowsInView) {
      const diff = focusedEventIndex - (this.rowsInView);
      const newRenderOffset = Math.round(this.renderOffset + diff);
      this.renderOffset = newRenderOffset;
      newSlice = s.recordsFiltered.slice(this.renderOffset, this.renderOffset + 100);
    }
    else if (focusedEventIndex < 1 && this.renderOffset > 0) {
      this.renderOffset -= 1;
      newSlice = s.recordsFiltered.slice(this.renderOffset, this.renderOffset + 100);
    }

    this.visibleRecords$.next(newSlice);
    return newSlice.indexOf(s.focusedEvent);
  }

}
