import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';

@Component({
  selector: 'app-filter',
  templateUrl: './filter.component.html',
  styleUrls: ['./filter.component.scss']
})
export class FilterComponent implements OnInit {

  @Input() title: string;
  @Input() form: FormGroup;
  @Input() filter: Set<any>;
  @Input() controlType: string | string[];
  lastWheelMove: number;
  scrollTop = 0;
  anyNotSelected: boolean;

  constructor() { }

  getControlNames() {
    return Object.getOwnPropertyNames(this.form.controls);
  }

  getControlType(i: number) {
    if (this.controlType instanceof Array) {
      return this.controlType[i];
    } else {
      return this.controlType;
    }
  }

  ngOnInit() {
    this.anyNotSelected = this.filter !== null;
  }

  onWheel(w: WheelEvent, div: HTMLElement) {
    if (w && (this.lastWheelMove === null || this.lastWheelMove !== w.timeStamp)) {
      this.lastWheelMove = w.timeStamp;
      if (w.deltaY < 0) {
        if (div.clientHeight + this.scrollTop < div.scrollHeight) {
          this.scrollTop = this.scrollTop + 20;
        }
      } else if (w.deltaY > 0 && this.scrollTop > 0) {
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
