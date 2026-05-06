import { TestBed, ComponentFixture} from '@angular/core/testing';
import { App } from './app';
import { ApiService } from './services/api';
import { of, throwError} from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('Swimlane Operations', () => {
    let component: App;
    let fixture: ComponentFixture<App>;
    let apiSpy: any;

    beforeEach(async () => {
        // Tworzymy szpiega (spy) dla ApiService
        apiSpy = {
            getTasks: vi.fn().mockReturnValue(of({ columns: [], swimlanes: [], tasks: [], users: [] })),
            addSwimlane: vi.fn().mockReturnValue(of({})),
            deleteSwimlane: vi.fn().mockReturnValue(of({})),
            updateSwimlane: vi.fn().mockReturnValue(of({})),
            
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

        component.swimlanes = [];
        fixture.detectChanges();
       
    });





    describe('Swimlane Actions (Add/Remove)', () => {
      beforeEach(() => {
        apiSpy.addSwimlane.mockReturnValue(of({}));
        apiSpy.deleteSwimlane.mockReturnValue(of({}));
        vi.spyOn(component, 'loadBoard').mockImplementation(() => {});
      });

      it('addSwimlane: should call API and reload board when name is provided', () => {
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Nowy Wiersz');
        const loadBoardSpy = vi.spyOn(component, 'loadBoard');

        component.addSwimlane();

        expect(apiSpy.addSwimlane).toHaveBeenCalledWith({ name: 'Nowy Wiersz' });
        expect(loadBoardSpy).toHaveBeenCalled();
        promptSpy.mockRestore();
      });

      it('addSwimlane: should return early if prompt is cancelled', () => {
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
        component.addSwimlane();
        expect(apiSpy.addSwimlane).not.toHaveBeenCalled();
        promptSpy.mockRestore();
      });

      it('addSwimlane: should log an error to the console when addSwimlane fails', () => {
        
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Testowy Wiersz');
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
         
        const mockError = new Error('Server Error');
        apiSpy.addSwimlane.mockReturnValue(throwError(() => mockError));
       
        component.addSwimlane();
        
        expect(consoleSpy).toHaveBeenCalledWith("Error while adding row:", mockError);
        
        promptSpy.mockRestore();
        consoleSpy.mockRestore();
      });

      it('removeSwimlane: should call delete and reload on confirm', () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        component.removeSwimlane(10);
        expect(apiSpy.deleteSwimlane).toHaveBeenCalledWith(10);
        expect(component.loadBoard).toHaveBeenCalled();
        confirmSpy.mockRestore();
      });

      it('removeSwimlane: should show alert on API error', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const errorResponse = { error: { error: 'Row is not empty' } };
        apiSpy.deleteSwimlane.mockReturnValue(throwError(() => errorResponse));

        component.removeSwimlane(10);

        expect(alertSpy).toHaveBeenCalledWith('Row is not empty');
        alertSpy.mockRestore();
      });
    });

    describe('isSwimlaneOverLimit', () => {
      it('should return false if limit is 0 or less', () => {
        const swim = { id: 1, limit: 0 };
        expect(component.isSwimlaneOverLimit(swim)).toBe(false);
      });

      it('should return true if tasks count exceeds limit', () => {
        const swim = { id: 1, limit: 2 };
        component.allTasks = [
          { id: 101, swimlane_id: 1 },
          { id: 102, swimlane_id: 1 },
          { id: 103, swimlane_id: 1 } // Trzeci task, limit to 2
        ];
    
        expect(component.isSwimlaneOverLimit(swim)).toBe(true);
      });

      it('should return false if tasks count is within limit', () => {
        const swim = { id: 1, limit: 5 };
        component.allTasks = [{ id: 101, swimlane_id: 1 }];
        expect(component.isSwimlaneOverLimit(swim)).toBe(false);
      });
    });

    describe('Swimlane Updates', () => {
      beforeEach(() => {
        apiSpy.updateSwimlane.mockReturnValue(of({}));
        vi.spyOn((component as any).zone, 'run').mockImplementation((fn: any) => fn());
        vi.spyOn((component as any).cdr, 'detectChanges').mockImplementation(() => {});
      });

      it('updateSwimlaneLimit: should update limit and detect changes', () => {
        const swim = { id: 1, limit: 5 };
        component.updateSwimlaneLimit(swim, '10');

        expect(apiSpy.updateSwimlane).toHaveBeenCalledWith(1, { limit: 10 });
        expect(swim.limit).toBe(10);
      });

      it('updateSwimlaneLimit: should set limit to 0 if negative value is passed', () => {
        const swim = { id: 1, limit: 5 };
        component.updateSwimlaneLimit(swim, '-5');
        expect(apiSpy.updateSwimlane).toHaveBeenCalledWith(1, { limit: 0 });
      });

      it('updateSwimlaneName: should call API with current name', () => {
        const swim = { id: 1, name: 'Nowa Nazwa' };
        const consoleSpy = vi.spyOn(console, 'log');
    
        component.updateSwimlaneName(swim);

        expect(apiSpy.updateSwimlane).toHaveBeenCalledWith(1, { name: 'Nowa Nazwa' });
        expect(consoleSpy).toHaveBeenCalledWith('Name updated');
      });

      it('updateSwimlaneLimit: should log an error to the console when updateSwimlaneLimit fails', () => {
        
        const swim = { id: 1, limit: 5 };
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Testowy Wiersz');
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
         
        const mockError = new Error('Server Error');
        apiSpy.updateSwimlane.mockReturnValue(throwError(() => mockError));
       
        component.updateSwimlaneLimit(swim, '10');
        
        expect(consoleSpy).toHaveBeenCalledWith(mockError);
        
        promptSpy.mockRestore();
        consoleSpy.mockRestore();
      });

      it('updateSwimlaneLimit: should log an error to the console when updateSwimlaneLimit fails', () => {
        
        const swim = { id: 1, name: 'Test Swimlane'};
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Testowy Wiersz');
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
         
        const mockError = new Error('Server Error');
        apiSpy.updateSwimlane.mockReturnValue(throwError(() => mockError));
       
        component.updateSwimlaneName(swim);
        
        expect(consoleSpy).toHaveBeenCalledWith(mockError);
        
        promptSpy.mockRestore();
        consoleSpy.mockRestore();
      });

    });

  });


