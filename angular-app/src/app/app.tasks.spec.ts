import { TestBed, ComponentFixture} from '@angular/core/testing';
import { App } from './app';
import { ApiService } from './services/api';
import { of} from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { moveItemInArray, transferArrayItem} from '@angular/cdk/drag-drop';




describe('Task Unit Tests', () => {
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
      updateTaskPosition: vi.fn().mockReturnValue(of({})),
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

    component.allTasks = [];
    fixture.detectChanges();
    

    
  });


  describe('drop', () => {
      let mockEvent: any;
      beforeEach(() => {
        apiSpy.updateTaskPosition.mockReturnValue(of({}));
        vi.spyOn(component, 'loadBoard').mockImplementation(() => {});

        mockEvent = {
          item: { data: { id: 100, content: 'Test Task' } },
          previousIndex: 0,
          currentIndex: 1,
          previousContainer: { data: [{ id: 100 }, { id: 101 }] },
          container: { data: [{ id: 100 }, { id: 101 }] },
        };
      });

      it('should move item in same array when containers are equal', () => {
        mockEvent.previousContainer = mockEvent.container;

        component.drop(mockEvent, 1, 2);


        expect(mockEvent.container.data[1].id).toBe(100);

        expect(apiSpy.updateTaskPosition).toHaveBeenCalledWith(100, 1, 2, 1);
      });

      it('should transfer item between arrays when containers are different', () => {
        mockEvent.previousContainer = { data: [{ id: 100 }] };
        mockEvent.container = { data: [{ id: 200 }] };

        component.drop(mockEvent, 8, 12);


        expect(mockEvent.container.data.length).toBe(2);

        expect(apiSpy.updateTaskPosition).toHaveBeenCalledWith(100, 8, 12, 1);
      });

      it('should reload board after successful API update', () => {
        const loadBoardSpy = vi.spyOn(component, 'loadBoard');
    
        component.drop(mockEvent, 1, 1);


        expect(loadBoardSpy).toHaveBeenCalled();
      });
  });

  describe('addItem', () => {
      it('should call addTask with correct data and reload board on success', () => {

        const mockValue = 'Zrobić zakupy';
        const mockColId = 5;
        const mockSwimId = 10;
  
        const addTaskSpy = apiSpy.addTask.mockReturnValue(of({ id: 1 }));
        const loadBoardSpy = vi.spyOn(component, 'loadBoard').mockImplementation(() => {});

        component.addItem( mockColId, mockSwimId, mockValue);

        expect(addTaskSpy).toHaveBeenCalledWith({
            content: mockValue,
            column_id: mockColId,
            swimlane_id: mockSwimId
        });

        expect(loadBoardSpy).toHaveBeenCalled();
      });

      it('should not add task if text is empty', () => {
        component.addItem(1, 10, '   ');
        expect(apiSpy.addTask).not.toHaveBeenCalled();
      });
  });

  describe('deleteTask', () => {

    it('should call deleteTask when removeItem is confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      component.removeItem(500);
      expect(apiSpy.deleteTask).toHaveBeenCalledWith(500);
    });

  });

  
});


