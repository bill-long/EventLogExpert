import { Component, Input, ElementRef, AfterViewInit, HostListener, OnChanges, OnDestroy } from '@angular/core';
import { EventRecord } from '../../providers/eventlog.models';
import { DomSanitizer } from '@angular/platform-browser';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.component.html',
  styleUrls: ['./event-detail.component.scss']
})
export class EventDetailComponent implements AfterViewInit, OnDestroy {

  @Input() focusedEvent$: Observable<EventRecord>;
  @Input() heightChange$: Observable<number>;

  scrollTop: number;
  lastWheelMove: number;
  outRef: ElementRef;
  detailDiv: HTMLElement;
  ngUnsubscribe = new Subject();

  constructor(private ds: DomSanitizer, private ref: ElementRef) {
    this.outRef = ref;
    this.lastWheelMove = null;
    this.scrollTop = 0;
  }

  getDescriptionHtml(r: EventRecord) {
    const html = r.Description.replace(/%n/g, '<br>');
    return this.ds.bypassSecurityTrustHtml(html);
  }

  ngAfterViewInit() {
    this.detailDiv = this.outRef.nativeElement.firstElementChild;
    this.heightChange$.pipe(takeUntil(this.ngUnsubscribe)).subscribe(h => this.scrollTop = this.detailDiv.scrollTop);
    this.focusedEvent$.pipe(takeUntil(this.ngUnsubscribe)).subscribe(e => this.scrollTop = this.detailDiv.scrollTop);
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
