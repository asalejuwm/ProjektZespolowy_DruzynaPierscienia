import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import { ANIMATION_MODULE_TYPE } from '@angular/platform-browser/animations';

// Inicjalizacja środowiska
TestBed.initTestEnvironment(
  [], 
  null as any,
  { teardown: { destroyAfterEach: true } }
);

// Konfiguracja globalna dla testów
TestBed.configureTestingModule({
  providers: [
    // Informujemy Angulara, że używamy trybu "Noop" (brak animacji)
    // bez wywoływania zdeprecjonowanych funkcji pomocniczych.
    { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }
  ]
});

/**
 * Uwaga: 'animate.enter' i 'animate.leave' to nowe funkcje API 
 * używane zazwyczaj wewnątrz metadanych komponentu @Component({ animations: [...] }).
 * W test-setup.ts definiujemy tylko grunt pod ich działanie.
 */