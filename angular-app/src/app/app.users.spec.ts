import { TestBed, ComponentFixture } from '@angular/core/testing';
import { App } from './app';
import { ApiService } from './services/api';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('User Assignments', () => {
  let component: App;
  let fixture: ComponentFixture<App>;
  let apiSpy: any;

  beforeEach(async () => {
    // 1. Skrócona inicjalizacja API - mockujemy tylko to, co niezbędne na start
    apiSpy = {
      getTasks: vi.fn().mockReturnValue(of({ columns: [], swimlanes: [], tasks: [], users: [] })),
      updateTask: vi.fn().mockReturnValue(of({})),
      updateUser: vi.fn().mockReturnValue(of({})),
      addUser: vi.fn().mockReturnValue(of({})),
      deleteUser: vi.fn().mockReturnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: ApiService, useValue: apiSpy },
        { provide: 'ANIMATIONS_MODULE_TYPE', useValue: 'NoopAnimations' }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    
    // 2. Globalne mocki dla powtarzalnych elementów
    vi.spyOn((component as any).cdr, 'detectChanges').mockImplementation(() => {});
    //vi.spyOn((component as any).zone, 'run').mockImplementation(fn => fn());

    fixture.detectChanges();
    component.allUsers = [
      { id: 1, username: 'Adam', color: '#ff0000', task_limit: 2 },
      { id: 2, username: 'Beata', color: '' },
      { id: 3, username: 'czarek' }
    ];

  });

  // 3. Parametryzacja prostych getterów (oszczędność ~30 linijek)
  describe('User Getters', () => {
    it.each([
      ['getUserName', 1, 'Adam'], ['getUserName', 99, 'Unknown'],
      ['getUserInitials', 1, 'AD'], ['getUserInitials', 3, 'CZ'], ['getUserInitials', 99, '??'],
      ['getUserColor', 1, '#ff0000'], ['getUserColor', 2, '#64748b'], ['getUserColor', 99, '#64748b']
    ])('%s(%i) should return %s', (method, id, expected) => {
      expect((component as any)[method](id)).toBe(expected);
    });
  });

  describe('Task Limits', () => {
    it('should validate user task limits correctly', () => {
      component.allTasks = [{ assignee_ids: [1] }, { assignee_ids: [1] }];
      expect(component.canUserAcceptTask(1)).toBe(false); // Adam has limit 2
      expect(component.canUserAcceptTask(2)).toBe(true);  // Default limit
    });
  });

  describe('toggleUserAssignment', () => {
    it('should add, remove or block assignment based on state and limit', () => {
      const task = { id: 10, assignee_ids: [1] };
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      
      // Remove existing
      component.toggleUserAssignment(task, 1);
      expect(task.assignee_ids).not.toContain(1);

      // Add new
      component.toggleUserAssignment(task, 2);
      expect(task.assignee_ids).toContain(2);

      // Block over limit
      vi.spyOn(component, 'canUserAcceptTask').mockReturnValue(false);
      component.toggleUserAssignment(task, 3);
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  describe('User CRUD (Create/Delete)', () => {
    it('should handle createUser success and error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      component.createUser('   '); // Early return
      expect(apiSpy.addUser).not.toHaveBeenCalled();

      apiSpy.addUser.mockReturnValue(of({ id: 5, username: 'Gienek' }));
      component.createUser('Gienek');
      expect(component.allUsers.some(u => u.username === 'Gienek')).toBe(true);

      apiSpy.addUser.mockReturnValue(throwError(() => new Error()));
      component.createUser('Error');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should delete user and cleanup tasks', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      component.allTasks = [{ id: 101, assignee_ids: [1, 2] }];
      
      component.deleteUser(1);
      expect(component.allUsers.length).toBe(2);
      expect(component.allTasks[0].assignee_ids).toEqual([2]);
    });
  });

  describe('onUserDropped', () => {
    // Wspólne dane dla testów w tym bloku
    const getTask = () => ({ id: 10, assignee_ids: [] as number[] });
    const event = { item: { data: { id: 2, username: 'Beata' } } } as any;

    it('should assign user on success', () => {
      const task = getTask();
      apiSpy.updateTask.mockReturnValue(of({}));
      
      component.onUserDropped(event, task);
      
      expect(task.assignee_ids).toContain(2);
      expect((component as any).cdr.detectChanges).toHaveBeenCalled();
    });

    it('should rollback assignee_ids if API fails', () => {
      const task = getTask();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Symulujemy błąd API
      apiSpy.updateTask.mockReturnValue(throwError(() => new Error('API Fail')));

      component.onUserDropped(event, task);

      // Po błędzie tablica powinna być pusta (id 2 dodane i usunięte w error block)
      expect(task.assignee_ids).not.toContain(2); 
      expect(task.assignee_ids.length).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('User Updates', () => {
    it('should update user limit and color', () => {
      const user = component.allUsers[0];
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      component.updateUserLimit(user, '5');
      expect(apiSpy.updateUser).toHaveBeenCalledWith(1, { task_limit: 5 });

      component.updateUserColor(user, '#000');
      expect(user.color).toBe('#000');
      expect(logSpy).toHaveBeenCalled();

      apiSpy.updateUser.mockReturnValue(throwError(() => new Error()));
      component.updateUserColor(user, '#fff');
      expect(alertSpy).toHaveBeenCalledWith("Couldn't save color");
    });
  });
});