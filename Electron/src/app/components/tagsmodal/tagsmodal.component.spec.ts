import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TagsmodalComponent } from './tagsmodal.component';

describe('TagsmodalComponent', () => {
  let component: TagsmodalComponent;
  let fixture: ComponentFixture<TagsmodalComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TagsmodalComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TagsmodalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
