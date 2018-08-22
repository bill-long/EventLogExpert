import { Component, Input, ElementRef, AfterViewInit, HostListener, OnChanges, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { EventRecord } from '../../providers/eventlog.models';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, Subject } from 'rxjs';
import { takeUntil, map, distinctUntilChanged } from 'rxjs/operators';
import { EventLogService, State } from '../../providers/eventlog.service';
import { ElectronService } from '../../providers/electron.service';

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.component.html',
  styleUrls: ['./event-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventDetailComponent implements AfterViewInit, OnDestroy {

  @Input() heightChange$: Observable<number>;

  scrollTop: number;
  lastWheelMove: number;
  detailDiv: HTMLElement;
  ngUnsubscribe = new Subject();
  focusedEvent$: Observable<EventRecord>;
  description$: Observable<SafeHtml>;

  constructor(
    private ds: DomSanitizer,
    private ref: ElementRef,
    private eventLogService: EventLogService,
    private electronService: ElectronService
  ) {
    this.lastWheelMove = null;
    this.scrollTop = 0;
    this.focusedEvent$ = eventLogService.state$.pipe(map(s => s.focusedEvent), distinctUntilChanged(), takeUntil(this.ngUnsubscribe));
    this.description$ = this.focusedEvent$.pipe(map(e => this.getDescriptionHtml(e)));
  }

  copyEventToClipboard(r: EventRecord) {
    this.electronService.clipboard.writeText(
      this.getDescriptionText(r)
    );
  }

  getDescriptionHtml(r: EventRecord) {
    const html = (r ? r.Description.replace(/(%n|\n)/g, '<br>') : '');
    return this.ds.bypassSecurityTrustHtml(html);
  }

  getDescriptionText(r: EventRecord) {
    return `LogName:       ${r.LogName}\r\n` +
      `Source:        ${r.ProviderName}\r\n` +
      `Date:          ${(new Date(r.TimeCreated)).toLocaleString()}\r\n` +
      `Event ID:      ${r.Id}\r\n` +
      `Task Category: ${r.TaskName}\r\n` +
      `Level:         ${r.LevelName}\r\n` +
      `User:          ${r.User ? r.User : 'N/A'}\r\n` +
      `Computer:      ${r.MachineName}\r\n` +
      `Description:\r\n` +
      `${r.Description.replace(/%n/g, '\r\n')}`;
  }

  ngAfterViewInit() {
    this.heightChange$
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(h => {
        this.scrollTop = this.ref.nativeElement.firstElementChild.firstElementChild.scrollTop;
      });

    // Reset scroll top when focused event changes
    this.eventLogService.state$.pipe(
      takeUntil(this.ngUnsubscribe),
      map(s => s.focusedEvent),
      distinctUntilChanged())
      .subscribe(e => this.scrollTop = 0);
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
  }

  onScrollBar(newPosition: number) {
    this.scrollTop = newPosition;
  }

  onWheel(w: WheelEvent, div: HTMLElement) {
    if (w && (this.lastWheelMove === null || this.lastWheelMove !== w.timeStamp)) {
      this.lastWheelMove = w.timeStamp;
      if (w.wheelDeltaY < 0) {
        if (div.clientHeight + this.scrollTop < div.scrollHeight) {
          this.scrollTop += 20;
        }
      } else if (w.wheelDeltaY > 0 && this.scrollTop > 0) {
        this.scrollTop -= 20;
        if (this.scrollTop < 0) {
          this.scrollTop = 0;
        }
      }
    }
  }

}
