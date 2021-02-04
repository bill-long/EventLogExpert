import { Component, Input, ElementRef, AfterViewInit, HostListener, OnChanges, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { EventRecord } from '../../providers/eventlog/eventlog.models';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, Subject } from 'rxjs';
import { takeUntil, map, distinctUntilChanged, take } from 'rxjs/operators';
import { EventLogService, ClearFocusedEventAction, getEventXml } from '../../providers/eventlog/eventlog';
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
  eventXml$: Observable<string>;
  showXml = false;

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
    this.eventXml$ = this.focusedEvent$.pipe(map(e => getEventXml(e, eventLogService)));
  }

  close() {
    this.eventLogService.actions$.next(new ClearFocusedEventAction());
  }

  copyToClipboard(includeXml: boolean) {
    this.eventLogService.state$.pipe(take(1)).subscribe(s => {
      if (s.selectedEvents.length > 1) {
        const eventTexts = s.selectedEvents.map(e => this.getDescriptionText(e) +
          (includeXml ? '\r\n' + getEventXml(e, this.eventLogService) : ''));
        this.electronService.clipboard.writeText(eventTexts.join('\r\n\r\n'));
      } else {
        this.electronService.clipboard.writeText(
          this.getDescriptionText(s.focusedEvent) +
          (includeXml ? '\r\n' + getEventXml(s.focusedEvent, this.eventLogService) : '')
        );
      }
    });
  }

  getDescriptionHtml(r: EventRecord) {
    const html = (r ? r.Description.replace(/(%n|\n)/g, '<br>') : '');
    return this.ds.bypassSecurityTrustHtml(html);
  }

  getDescriptionText(r: EventRecord) {
    return `LogName:       ${r.LogName}\r\n` +
      `Source:        ${r.ProviderName}\r\n` +
      `Date:          ${r.TimeCreatedString}\r\n` +
      `Event ID:      ${r.Id}\r\n` +
      `Task Category: ${r.TaskName.trim()}\r\n` +
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
      if (w.deltaY > 0) {
        if (div.clientHeight + this.scrollTop < div.scrollHeight) {
          this.scrollTop += 20;
        }
      } else if (w.deltaY < 0) {
        this.scrollTop -= 20;
        if (this.scrollTop < 0) {
          this.scrollTop = 0;
        }
      }
    }
  }

}
