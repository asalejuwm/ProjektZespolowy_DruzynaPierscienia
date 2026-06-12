import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import { ANIMATION_MODULE_TYPE } from '@angular/platform-browser/animations';

TestBed.initTestEnvironment(
  [], 
  null as any,
  { teardown: { destroyAfterEach: true } }
);

TestBed.configureTestingModule({
  providers: [
    { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }
  ]
});
