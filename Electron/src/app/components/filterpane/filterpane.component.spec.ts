import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterPaneComponent } from './filterpane.component';

describe('FilterPaneComponent', () => {
  let component: FilterPaneComponent;
  let fixture: ComponentFixture<FilterPaneComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FilterPaneComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FilterPaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
