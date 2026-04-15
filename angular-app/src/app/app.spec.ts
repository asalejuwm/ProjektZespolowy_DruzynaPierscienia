import { TestBed, ComponentFixture } from '@angular/core/testing';
import { App } from './app';
import { ApiService } from './services/api';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectorRef, NgZone } from '@angular/core';

describe('App Component Unit Tests', () => {
  let component: App;
  let fixture: ComponentFixture<App>;
  let apiSpy: any;

  beforeEach(async () => {
    // Tworzymy szpiega (spy) dla ApiService
    apiSpy = {
      getTasks: vi.fn().mockReturnValue(of({ columns: [], swimlanes: [], tasks: [], users: [] })),
      addTask: vi.fn().mockReturnValue(of({})),
      deleteTask: vi.fn().mockReturnValue(of({})),
      updateTask: vi.fn().mockReturnValue(of({})),
      addColumn: vi.fn().mockReturnValue(of({})),
      updateColumn: vi.fn().mockReturnValue(of({})),
      deleteColumn: vi.fn().mockReturnValue(of({})),
      updateColumnOrder: vi.fn().mockReturnValue(of({})),
      addSwimlane: vi.fn().mockReturnValue(of({})),
      deleteSwimlane: vi.fn().mockReturnValue(of({})),
      updateUser: vi.fn().mockReturnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: ApiService, useValue: apiSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // --- TESTY LOGIKI KOLORÓW ---
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

  // --- TESTY LIMITÓW WIP ---
  describe('WIP Limits', () => {
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

  // --- TESTY CRUD KOLUMN ---
  describe('Column Operations', () => {
    it('should call addColumn API when addColumn is triggered', () => {
      vi.spyOn(window, 'prompt').mockReturnValue('New Dev Column');
      component.addColumn();
      expect(apiSpy.addColumn).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Dev Column' }));
    });

    it('should correctly identify immutable columns', () => {
      expect(component.isImmutable({ title: 'To do' })).toBe(true);
      expect(component.isImmutable({ title: 'In Progress' })).toBe(false);
    });

    it('should validate limit before saving column', () => {
      const mockCol = { id: 5 };
      const data = { title: 'Test', limit: '-5', header_color: '#000', bg_color: '#fff' };
      
      component.saveColumn(mockCol, data);
      
      // Powinien zmienić -5 na 0
      expect(apiSpy.updateColumn).toHaveBeenCalledWith(5, expect.objectContaining({ limit: 0 }));
    });
  });

  // --- TESTY ZADAŃ ---
  describe('Task Operations', () => {
    it('should not add task if text is empty', () => {
      component.addItem(1, 10, '   ');
      expect(apiSpy.addTask).not.toHaveBeenCalled();
    });

    it('should call deleteTask when removeItem is confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      component.removeItem(500);
      expect(apiSpy.deleteTask).toHaveBeenCalledWith(500);
    });

    it('should calculate subtask progress correctly', () => {
      const task = {
        subtasks: [
          { is_completed: true },
          { is_completed: true },
          { is_completed: false },
          { is_completed: false },
        ]
      };
      // 2 z 4 = 50%
      expect(component.getSubtaskProgress(task)).toBe(50);
    });

    it('should return 0 progress if no subtasks', () => {
      const task = { subtasks: [] };
      expect(component.getSubtaskProgress(task)).toBe(0);
    });
  });

  // --- TESTY UŻYTKOWNIKÓW ---
  describe('User Assignments', () => {
    it('should check if user can accept more tasks based on limit', () => {
      component.allUsers = [{ id: 1, username: 'Adam', task_limit: 2 }];
      component.allTasks = [
        { assignee_ids: [1] },
        { assignee_ids: [1] }
      ];

      // Adam ma limit 2 i ma już 2 zadania -> false
      expect(component.canUserAcceptTask(1)).toBe(false);
    });

    it('should allow assigning if limit is not reached', () => {
      component.allUsers = [{ id: 1, username: 'Adam', task_limit: 5 }];
      component.allTasks = [{ assignee_ids: [1] }];
      
      expect(component.canUserAcceptTask(1)).toBe(true);
    });
  });
});