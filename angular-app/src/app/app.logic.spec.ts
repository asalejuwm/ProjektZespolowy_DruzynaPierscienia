import { TestBed, ComponentFixture} from '@angular/core/testing';
import { App } from './app';
import { ApiService } from './services/api';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach} from 'vitest';




describe('App Component Logic Unit Tests', () => {
  let component: App;
  let fixture: ComponentFixture<App>;
  let apiSpy: any;

  beforeEach(async () => {
    // Tworzymy szpiega (spy) dla ApiService
    apiSpy = {
      getTasks: vi.fn().mockReturnValue(of({ columns: [], swimlanes: [], tasks: [], users: [] })),
    };

    TestBed.overrideComponent(App, {
      set: {
        animations: [] // Wyłączamy animacje dla testów, aby uniknąć problemów z asynchronicznością
      }
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: ApiService, useValue: apiSpy },
        { provide: 'ANIMATIONS_MODULE_TYPE', useValue: 'NoopAnimations' }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;

    component.allTasks = [];

    fixture.detectChanges();
  });

  describe('Grid & Task Logic', () => {

    it('should log an error to the console when getTasks fails', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  
      const mockError = new Error('Server Error');
      apiSpy.getTasks.mockReturnValue(throwError(() => mockError));

      component.loadBoard();

      expect(consoleSpy).toHaveBeenCalledWith("Error loading board:", mockError);

      consoleSpy.mockRestore();
    });

    describe('getTasksForCell', () => {
      it('should filter and sort tasks correctly for a specific cell', () => {

        component.allTasks = [
          { id: 1, column_id: 1, swimlane_id: 1, order: 2, content: 'Drugie' },
          { id: 2, column_id: 1, swimlane_id: 1, order: 1, content: 'Pierwsze' },
          { id: 3, column_id: 2, swimlane_id: 1, order: 0, content: 'Inna kolumna' },
          { id: 4, column_id: 1, swimlane_id: 2, order: 0, content: 'Inny swimlane' },
        ] as any;

        const result = component.getTasksForCell(1, 1);

        expect(result.length).toBe(2);
        expect(result[0].id).toBe(2); // order 1
        expect(result[1].id).toBe(1); // order 2
      });

      it.only('should return an empty array if no tasks match the cell', () => {
        component.allTasks = [{ id: 1, column_id: 1, swimlane_id: 1, order: 1 }] as any;
        const result = component.getTasksForCell(99, 99);
        expect(result).toEqual([]);
      });
    });

    describe('getCellId', () => {
      it('should format cell ID string correctly', () => {
        const id = component.getCellId(5, 10);
        expect(id).toBe('cell-5-10');
      });
    });

    describe('allCellIds', () => {
      it('should generate a full list of cell IDs based on columns and swimlanes', () => {

        component.columns = [{ id: 1 }, { id: 2 }] as any;
        component.swimlanes = [{ id: 10 }, { id: 20 }] as any;

        const ids = component.allCellIds;

        expect(ids.length).toBe(4);

        expect(ids).toContain('cell-1-10');
        expect(ids).toContain('cell-1-20');
        expect(ids).toContain('cell-2-10');
        expect(ids).toContain('cell-2-20');
      });

      it('should return empty array if there are no columns or swimlanes', () => {
       component.columns = [];
       component.swimlanes = [];
       expect(component.allCellIds).toEqual([]);
      });
    });
  });

  describe('Contrast Color Logic', () => {
    it('should return dark text color (#1e293b) for light backgrounds', () => {
      expect(component.getContrastColor('#ffffff')).toBe('#1e293b'); // Biały -> Ciemny
      expect(component.getContrastColor('#ffff00')).toBe('#1e293b'); // Żółty -> Ciemny
    });

    it('should return white text color (#ffffff) for dark backgrounds', () => {
      expect(component.getContrastColor('#000000')).toBe('#ffffff'); // Czarny -> Biały
      expect(component.getContrastColor('#1e293b')).toBe('#ffffff'); // Granatowy -> Biały
    });

    it('should return default color if hex is missing', () => {
      expect(component.getContrastColor('')).toBe('#1e293b');
    });
  });

  it('should correctly identify immutable columns', () => {
      expect(component.isImmutable({ title: 'To do' })).toBe(true);
      expect(component.isImmutable({ title: 'In Progress' })).toBe(false);
    });



  describe('WIP Limits Logic', () => {
    it('should detect when a column is over WIP limit', () => {
      const mockCol = { id: 1, limit: 2 };
      component.swimlanes = [{ id: 10 }];
      component.allTasks = [
        { id: 101, column_id: 1, swimlane_id: 10 },
        { id: 102, column_id: 1, swimlane_id: 10 },
        { id: 103, column_id: 1, swimlane_id: 10 }
      ];

      // Limit 2, zadań 3 -> true
      expect(component.isOverLimit(mockCol)).toBe(true);
    });

    it('should return false if WIP limit is set to 0 or NaN', () => {
      const mockCol = { id: 1, limit: 0 };
      component.allTasks = [{ id: 101, column_id: 1, swimlane_id: 10 }];
      expect(component.isOverLimit(mockCol)).toBe(false);
    });
  });
});

