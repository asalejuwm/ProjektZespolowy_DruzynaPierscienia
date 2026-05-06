import { TestBed, ComponentFixture } from '@angular/core/testing';
import { App } from './app';
import { ApiService } from './services/api';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('Active Edit Menu', () => {

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


    describe('Getters for Active Elements', () => {
      beforeEach(() => {
        component.columns = [{ id: 1, title: 'Col 1' }];
        component.swimlanes = [{ id: 2, name: 'Swim 1' }];
        component.allTasks = [{ id: 3, content: 'Task 1' }];
      });

      it('getActiveColumn: should return the column matching activeEditMenu id', () => {
        component.activeEditMenu = { id: 1, type: 'column' };
        expect(component.getActiveColumn()).toEqual(component.columns[0]);
      });

      it('getActiveSwimlane: should return the swimlane matching activeEditMenu id', () => {
        component.activeEditMenu = { id: 2, type: 'swimlane' };
        expect(component.getActiveSwimlane()).toEqual(component.swimlanes[0]);
      });

      it('getActiveTask: should return the task matching activeEditMenu id', () => {
        component.activeEditMenu = { id: 3, type: 'task' };
        expect(component.getActiveTask()).toEqual(component.allTasks[0]);
      });

      it('should return undefined if activeEditMenu is null', () => {
        component.activeEditMenu = null;
        expect(component.getActiveColumn()).toBeUndefined();
      });
    });
    describe('Menu Management', () => {
      let mockEvent: any;

      beforeEach(() => {
        mockEvent = {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn()
        };
      });

      it('toggleEditMenu: should open menu if different id/type is clicked', () => {
        component.activeEditMenu = null;
        component.toggleEditMenu('task', 5, mockEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
        expect(component.activeEditMenu).toEqual({ type: 'task', id: 5 });
      });

      it('toggleEditMenu: should close menu if the same id/type is clicked again', () => {
        component.activeEditMenu = { type: 'column', id: 10 };
        component.toggleEditMenu('column', 10, mockEvent);

        expect(component.activeEditMenu).toBeNull();
      });

      it('closeEditMenu: should set activeEditMenu to null', () => {
        component.activeEditMenu = { type: 'task', id: 1 };
        component.closeEditMenu();
        expect(component.activeEditMenu).toBeNull();
      });
    });

    describe('saveTaskContent', () => {
      let mockTask: any;

      beforeEach(() => {
        mockTask = { id: 100, content: 'Original' };
        apiSpy.updateTask.mockReturnValue(of({}));
        vi.spyOn((component as any).cdr, 'detectChanges').mockImplementation(() => {});
        component.activeEditMenu = { type: 'task', id: 100 };
      });

      it('should return early and close menu if newContent is empty after trim', () => {
        component.saveTaskContent(mockTask, '   ');
        expect(apiSpy.updateTask).not.toHaveBeenCalled();
        expect(component.activeEditMenu).toBeNull();
      });

      it('should return early if content has not changed', () => {
        component.saveTaskContent(mockTask, 'Original');
        expect(apiSpy.updateTask).not.toHaveBeenCalled();
        expect(component.activeEditMenu).toBeNull();
      });

      it('should call API, update task and detect changes on success', () => {
        component.saveTaskContent(mockTask, ' Updated Content ');

        expect(apiSpy.updateTask).toHaveBeenCalledWith(100, { content: 'Updated Content' });
        expect(mockTask.content).toBe('Updated Content');
        expect(component.activeEditMenu).toBeNull();
        expect((component as any).cdr.detectChanges).toHaveBeenCalled();
      });

      it('should log error if API update fails', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        apiSpy.updateTask.mockReturnValue(throwError(() => new Error('Update failed')));

        component.saveTaskContent(mockTask, 'New Content');

        expect(consoleSpy).toHaveBeenCalledWith("Error updating task:", expect.any(Error));
        consoleSpy.mockRestore();
      });
    });

  });