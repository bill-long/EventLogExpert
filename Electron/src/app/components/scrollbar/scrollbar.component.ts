import {
  Component, OnInit, Input, ChangeDetectionStrategy, ElementRef,
  OnChanges, Output, EventEmitter, HostListener, OnDestroy
} from '@angular/core';

@Component({
  selector: 'app-scrollbar',
  templateUrl: './scrollbar.component.html',
  styleUrls: ['./scrollbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScrollbarComponent implements OnInit, OnChanges, OnDestroy {

  @Input() rowcount: number;
  @Input() position: number;
  @Input() rowsVisible: number;
  @Output() updatePosition: EventEmitter<number>;
  cursorSize = 20;
  subtractCursorSize = false;
  padding: number;
  dragData: { mouseY: number, padding: number };

  constructor(private el: ElementRef) {
    this.updatePosition = new EventEmitter();
  }

  ngOnInit() {
  }

  ngOnChanges() {
    if (!this.rowcount) { return; }

    const ne = this.el.nativeElement as Element;
    let height = ne.clientHeight;

    if (this.rowsVisible > 1) {
      const percentVisible = this.rowsVisible / this.rowcount;
      this.cursorSize = height * percentVisible;
      if (this.cursorSize < 20) {
        this.cursorSize = 20;
        this.subtractCursorSize = true;
        height = height - this.cursorSize;
      }
    } else {
      this.subtractCursorSize = true;
      height = height - this.cursorSize;
    }

    const rowsPerPixel = this.rowcount / height;
    this.padding = Math.floor(this.position / rowsPerPixel);
  }

  ngOnDestroy() {
    this.updatePosition.complete();
  }

  onMouseDown(evt: any) {
    this.dragData = { mouseY: evt.clientY, padding: this.padding };
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(evt: MouseEvent) {
    if (this.dragData != null) {
      const difference = this.dragData.mouseY - evt.clientY;
      this.padding = this.dragData.padding - difference;

      const ne = this.el.nativeElement as Element;
      let height = ne.clientHeight;
      if (this.subtractCursorSize) {
        height = height - this.cursorSize;
        if (this.padding > height) { this.padding = height; }
      } else {
        if (this.padding > height - this.cursorSize) {
          this.padding = height - this.cursorSize;
        }
      }

      if (this.padding < 0) { this.padding = 0; }

      const rowsPerPixel = this.rowcount / height;
      let newPosition = Math.round(rowsPerPixel * this.padding);
      if (newPosition > this.rowcount - 5) { newPosition = this.rowcount - 5; }
      this.updatePosition.next(newPosition);
    }
  }

  @HostListener('window:mouseup')
  onMouseUp() {
    this.dragData = null;
  }

}
