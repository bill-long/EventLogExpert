import { Component, OnInit, Input, ChangeDetectionStrategy, ElementRef,
  OnChanges, Output, EventEmitter, HostListener } from '@angular/core';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-scrollbar',
  templateUrl: './scrollbar.component.html',
  styleUrls: ['./scrollbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScrollbarComponent implements OnInit, OnChanges {

  @Input() rowcount: number;
  @Input() position: number;
  @Output() updatePosition: EventEmitter<number>;
  padding: number;
  dragData: { mouseY: number, padding: number };

  constructor(private el: ElementRef) {
    this.updatePosition = new EventEmitter();
    this.rowcount = 0;
  }

  ngOnInit() {
  }

  ngOnChanges() {
    if (!this.rowcount) { return; }

    const ne = this.el.nativeElement as Element;
    const height = ne.clientHeight;
    const rowsPerPixel = this.rowcount / (height - 20); // subtract size of cursor
    this.padding = Math.floor(this.position / rowsPerPixel);
  }

  onMouseDown(evt: any) {
    this.dragData = { mouseY: evt.clientY, padding: this.padding };
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(evt: MouseEvent) {
    if (this.dragData != null) {
      const ne = this.el.nativeElement as Element;
      const height = ne.clientHeight;

      const difference = this.dragData.mouseY - evt.clientY;
      this.padding = this.dragData.padding - difference;
      if (this.padding < 0) { this.padding = 0; }
      if (this.padding > height - 20) { this.padding = height - 20; }

      const rowsPerPixel = this.rowcount / (height - 20); // subtract size of cursor
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
