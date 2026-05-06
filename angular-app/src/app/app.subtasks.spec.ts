import { TestBed, ComponentFixture } from '@angular/core/testing';
import { App } from './app';
import { ApiService } from './services/api';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('Subtask Operations', () => {

  let component: App;
  let fixture: ComponentFixture<App>;
  let apiSpy: any;

  beforeEach(async () => {
    // Tworzymy szpiega (spy) dla ApiService
    apiSpy = {
      getTasks: vi.fn().mockReturnValue(of({ columns: [], swimlanes: [], tasks: [], users: [] })),
      updateTask: vi.fn().mockReturnValue(of({})),
      updateSwimlane: vi.fn().mockReturnValue(of({})),
      addSubtask: vi.fn().mockReturnValue(of({})),
      updateSubtask: vi.fn().mockReturnValue(of({})),
      deleteSubtask: vi.fn().mockReturnValue(of({})),
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



    describe('toggleTaskCompletion', () => {
      let mockTask: any;

      beforeEach(() => {
        mockTask = { id: 1, is_completed: false };
        apiSpy.updateTask.mockReturnValue(of({}));
        vi.spyOn((component as any).zone, 'run').mockImplementation((fn: any) => fn());
        vi.spyOn((component as any).cdr, 'detectChanges').mockImplementation(() => {});
      });

      it('should return early if the state is already the same', () => {
        component.toggleTaskCompletion(mockTask, false);
        expect(apiSpy.updateTask).not.toHaveBeenCalled();
      });

      it('should update state and detect changes on success', () => {
        component.toggleTaskCompletion(mockTask); // przełączy na true
        expect(apiSpy.updateTask).toHaveBeenCalledWith(1, { is_completed: true });
        expect(mockTask.is_completed).toBe(true);
        expect((component as any).cdr.detectChanges).toHaveBeenCalled();
      });
    });
    
    describe('Subtask Basics', () => {
      beforeEach(() => {
        vi.spyOn((component as any).zone, 'run').mockImplementation((fn: any) => fn());
        vi.spyOn((component as any).cdr, 'detectChanges').mockImplementation(() => {});
      });

      it('addSubtask: should initialize array and add new subtask', () => {
        const task = { id: 1 }; // brak tablicy subtasks
        const newSub = { id: 101, content: 'Test sub' };
        apiSpy.addSubtask.mockReturnValue(of(newSub));

        component.addSubtask(task, 'Test sub');

        expect((task as any).subtasks).toContain(newSub);
        expect((component as any).cdr.detectChanges).toHaveBeenCalled();
      });

      it('deleteSubtask: should filter out the deleted subtask', () => {
        const task = { id: 1, subtasks: [{ id: 101 }, { id: 102 }] };
        apiSpy.deleteSubtask.mockReturnValue(of({}));

        component.deleteSubtask(task, 101);

        expect(task.subtasks.length).toBe(1);
        expect(task.subtasks[0].id).toBe(102);
      });
    });

    describe('toggleSubtaskCompletion Logic', () => {
      let task: any;

      beforeEach(() => {
        apiSpy.updateSubtask.mockReturnValue(of({}));
        apiSpy.updateTask.mockReturnValue(of({}));
        vi.spyOn((component as any).zone, 'run').mockImplementation((fn: any) => fn());
    
        task = { 
          id: 1, 
          is_completed: false, 
          subtasks: [
            { id: 101, is_completed: true },
            { id: 102, is_completed: false }
          ] 
        };
      });

      it('should complete the main task if all subtasks are completed', () => {
        const subtaskToToggle = task.subtasks[1]; // ten z is_completed: false
        const toggleSpy = vi.spyOn(component, 'toggleTaskCompletion');

        component.toggleSubtaskCompletion(task, subtaskToToggle);

        expect(subtaskToToggle.is_completed).toBe(true);
        // Ponieważ oba subtaski są teraz true, powinien wywołać toggleTaskCompletion dla całego zadania
        expect(toggleSpy).toHaveBeenCalledWith(task, true);
      });

      it('should uncomplete the main task if one subtask becomes uncompleted', () => {
        task.is_completed = true;
        task.subtasks[0].is_completed = true;
        task.subtasks[1].is_completed = true;
        const subtaskToToggle = task.subtasks[0];
        const toggleSpy = vi.spyOn(component, 'toggleTaskCompletion');

        component.toggleSubtaskCompletion(task, subtaskToToggle);

        expect(subtaskToToggle.is_completed).toBe(false);
        expect(toggleSpy).toHaveBeenCalledWith(task, false);
      });
    });

    describe('saveSubtaskContent', () => {
      let subtask: any;

      beforeEach(() => {
        subtask = { id: 5, content: 'Old content' };
        component.editingSubtaskId = 5;
        apiSpy.updateSubtask.mockReturnValue(of({}));
        vi.spyOn((component as any).zone, 'run').mockImplementation((fn: any) => fn());
      });

      it('should return early and reset id if content is unchanged or empty', () => {
        component.saveSubtaskContent(subtask, 'Old content');
        expect(apiSpy.updateSubtask).not.toHaveBeenCalled();
        expect(component.editingSubtaskId).toBeNull();

        component.editingSubtaskId = 5;
        component.saveSubtaskContent(subtask, '   ');
        expect(component.editingSubtaskId).toBeNull();
      });

      it('should update content and reset editingSubtaskId on success', () => {
        component.saveSubtaskContent(subtask, 'New unique content');
        expect(subtask.content).toBe('New unique content');
        expect(component.editingSubtaskId).toBeNull();
      });

      it('should reset editingSubtaskId even on error', () => {
        apiSpy.updateSubtask.mockReturnValue(throwError(() => new Error('fail')));
        component.saveSubtaskContent(subtask, 'Error content');
        expect(component.editingSubtaskId).toBeNull();
      });
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

