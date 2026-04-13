import { TestBed, ComponentFixture } from '@angular/core/testing';
import { App } from './app';
import { ApiService } from './services/api';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';


describe('App Component Unit Tests', () => {
  let component: App;
  let fixture: ComponentFixture<App>;
  let apiSpy: any;

  beforeEach(async () => {
    
    apiSpy = {
      getTasks: vi.fn().mockReturnValue(of({ 
        columns: [], 
        swimlanes: [], 
        tasks: [], 
        users: [] 
      }))
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: ApiService, useValue: apiSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
  });




  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // COLUMN TESTS




  it('should calculate white text for dark background (Contrast Logic)', () => {
    const darkColor = '#000000'; // Czarny
    const result = component.getContrastColor(darkColor);
    expect(result).toBe('#ffffff'); // Powinien zwrócić biały tekst
  });

  it('should calculate black text for light background', () => {
    const lightColor = '#ffffff'; // Biały
    const result = component.getContrastColor(lightColor); 
    expect(result).toBe('#1e293b'); 
  });

  it('should detect when a column is over WIP limit', () => {
    const mockColumn = { id: 1, limit: 2 };

    component.swimlanes = [
      { id: 10, name: 'Active Row' }
    ];

    component.allTasks = [
      { id: 101, column_id: 1, swimlane_id: 10 },
      { id: 102, column_id: 1, swimlane_id: 10 },
      { id: 103, column_id: 1, swimlane_id: 10 }
    ];
    
    // limit = 2, count = 3 -> wynik powinien być true
    const result = component.isOverLimit(mockColumn);
    
    expect(result).toBe(true);
  });

  it('should return false if column is under limit', () => {
    const mockColumn = { id: 1, limit: 5 };
    component.swimlanes = [{ id: 10 }];
    component.allTasks = [{ id: 101, column_id: 1, swimlane_id: 10 }];

    expect(component.isOverLimit(mockColumn)).toBe(false);
  });

});
