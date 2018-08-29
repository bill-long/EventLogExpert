import { Component, Input, ElementRef, AfterViewInit, HostListener, OnChanges, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { EventRecord } from '../../providers/eventlog.models';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, Subject } from 'rxjs';
import { takeUntil, map, distinctUntilChanged, take } from 'rxjs/operators';
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
  eventXml$: Observable<string>;

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
    this.eventXml$ = this.focusedEvent$.pipe(map(e => this.getEventXml(e)));
  }

  copyToClipboard(includeXml: boolean) {
    this.eventLogService.state$.pipe(take(1)).subscribe(s => {
      if (s.selectedEvents.length > 1) {
        const eventTexts = s.selectedEvents.map(e => this.getDescriptionText(e) +
          (includeXml ? '\r\n' + this.getEventXml(e) : ''));
        this.electronService.clipboard.writeText(eventTexts.join('\r\n\r\n'));
      } else {
        this.electronService.clipboard.writeText(
          this.getDescriptionText(s.focusedEvent) +
          (includeXml ? '\r\n' + this.getEventXml(s.focusedEvent) : '')
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
      `Date:          ${(new Date(r.TimeCreated)).toLocaleString()}\r\n` +
      `Event ID:      ${r.Id}\r\n` +
      `Task Category: ${r.TaskName.trim()}\r\n` +
      `Level:         ${r.LevelName}\r\n` +
      `User:          ${r.User ? r.User : 'N/A'}\r\n` +
      `Computer:      ${r.MachineName}\r\n` +
      `Description:\r\n` +
      `${r.Description.replace(/%n/g, '\r\n')}`;
  }

  getEventXml(r: EventRecord) {
    if (!r) { return ''; }
    return `<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">\r\n` +
      `  <System>\r\n` +
      `    <Provider Name="${r.ProviderName}" />\r\n` +
      `    <EventID` + (r.Qualifiers ? ` Qualifiers="${r.Qualifiers}"` : ``) + `>${r.Id}</EventID>\r\n` +
      `    <Level>${r.Level}</Level>\r\n` +
      `    <Task>${r.Task}</Task>\r\n` +
      `    <Keywords>${r.Keywords ? r.Keywords.toString(16) : '0x0'}</Keywords>\r\n` +
      `    <TimeCreated SystemTime="${new Date(r.TimeCreated).toISOString()}" />\r\n` +
      `    <EventRecordID>${r.RecordId}</EventRecordID>\r\n` +
      `    <Channel>${r.LogName}</Channel>\r\n` +
      `    <Computer>${r.MachineName}</Computer>\r\n` +
      `  </System>\r\n` +
      `  <EventData>\r\n` +
      r.Properties.map(p => `    <Data>${p}</Data>`).join('\r\n') + '\r\n' +
      `  </EventData>\r\n` +
      `</Event>`;
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
