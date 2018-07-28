import { Component, OnInit, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-filter',
  templateUrl: './filter.component.html',
  styleUrls: ['./filter.component.scss']
})
export class FilterComponent implements OnInit {

  @Input() title: string;
  @Input() form: FormGroup;
  @Input() filter: Set<any>;
  lastWheelMove: number;
  scrollTop = 0;
  anyNotSelected: boolean;

  constructor() { }

  getControlNames() {
    return Object.getOwnPropertyNames(this.form.controls);
  }

  ngOnInit() {
    this.anyNotSelected = this.filter !== null;
  }

  onWheel(w: WheelEvent, div: HTMLElement) {
    if (w && (this.lastWheelMove === null || this.lastWheelMove !== w.timeStamp)) {
      this.lastWheelMove = w.timeStamp;
      if (w.wheelDeltaY < 0) {
        if (div.clientHeight + this.scrollTop < div.scrollHeight) {
          this.scrollTop = this.scrollTop + 20;
        }
      } else if (w.wheelDeltaY > 0 && this.scrollTop > 0) {
        this.scrollTop = this.scrollTop - 20;
        if (this.scrollTop < 0) {
          this.scrollTop = 0;
        }
      }
    }
  }

  setAllFormValues(val: boolean) {
    const controlNames = this.getControlNames();
    const newValue = {};
    controlNames.forEach(n => newValue[n] = val);
    this.form.setValue(newValue);
    this.anyNotSelected = !val;
  }

  setScrollValue(v) {
    this.scrollTop = v;
  }

}
