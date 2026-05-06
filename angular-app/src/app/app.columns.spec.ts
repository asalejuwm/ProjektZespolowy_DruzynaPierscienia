import { TestBed, ComponentFixture} from '@angular/core/testing';
import { App } from './app';
import { ApiService } from './services/api';
import { of, throwError} from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';


describe('Column Operations', () => {
    let component: App;
    let fixture: ComponentFixture<App>;
    let apiSpy: any;

    beforeEach(async () => {
        // Tworzymy szpiega (spy) dla ApiService
        apiSpy = {
            getTasks: vi.fn().mockReturnValue(of({ columns: [], swimlanes: [], tasks: [], users: [] })),
            addColumn: vi.fn().mockReturnValue(of({})),
            updateColumn: vi.fn().mockReturnValue(of({})),
            deleteColumn: vi.fn().mockReturnValue(of({})),
            updateColumnOrder: vi.fn().mockReturnValue(of({})),
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

        component.columns = [];
        fixture.detectChanges();
       
    });

    it('should call addColumn API when addColumn is triggered', () => {
      vi.spyOn(window, 'prompt').mockReturnValue('New Dev Column');
      component.addColumn();
      expect(apiSpy.addColumn).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Dev Column' }));
    });

    
    it('should validate limit before saving column', () => {
      const mockCol = { id: 5 };
      const data = { title: 'Test', limit: '-5', header_color: '#000', bg_color: '#fff' };
      
      component.saveColumn(mockCol, data);
      
      expect(apiSpy.updateColumn).toHaveBeenCalledWith(5, expect.objectContaining({ limit: 0 }));
    });

    it('should set editingColumn and focus/select the input', () => {

      vi.useFakeTimers();

      const mockCol = { id: 1, title: 'Do zrobienia' };
  
      const inputElement = document.createElement('input');
      inputElement.className = 'edit-input';
      document.body.appendChild(inputElement);

      const focusSpy = vi.spyOn(inputElement, 'focus');
      const selectSpy = vi.spyOn(inputElement, 'select');

      component.startEditColumn(mockCol);

      expect(component.editingColumn).toBe(mockCol);

      vi.advanceTimersByTime(0);

      expect(focusSpy).toHaveBeenCalled();
      expect(selectSpy).toHaveBeenCalled();

      document.body.removeChild(inputElement);
      vi.useRealTimers(); // Powrót do rzeczywistego czasu
    });
    
    it('should log an error to the console when updateColumn API fails', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  
      const mockError = new Error('Database connection failed');
      apiSpy.updateColumn.mockReturnValue(throwError(() => mockError));

      const mockCol = { id: 1, title: 'Nazwa' };

      component.saveColumn(mockCol, { title: 'NowaNazwa', limit: 5, header_color: '#fff', bg_color: '#000' });

      expect(consoleSpy).toHaveBeenCalledWith("Error updating column:", mockError);

      consoleSpy.mockRestore();
    });

    describe('updateLimit', () => {
      let mockCol: any;

      beforeEach(() => {
        mockCol = { id: 1, limit: 5 };
        apiSpy.updateColumn.mockReturnValue(of({}));
        vi.spyOn((component as any).zone, 'run').mockImplementation((fn: any) => fn());
        vi.spyOn((component as any).cdr, 'detectChanges').mockImplementation(() => {});
      });

      it('should return early if limit is not a number', () => {
        component.updateLimit(mockCol, 'nie-liczba');
        expect(apiSpy.updateColumn).not.toHaveBeenCalled();
      });

      it('should set limit to 0 if input is negative', () => {
        component.updateLimit(mockCol, -10);
    
        expect(apiSpy.updateColumn).toHaveBeenCalledWith(1, { limit: 0 });
        expect(mockCol.limit).toBe(0);
      });

      it('should update column limit and trigger change detection on success', () => {
        component.updateLimit(mockCol, '15');

        expect(apiSpy.updateColumn).toHaveBeenCalledWith(1, { limit: 15 });
        expect(mockCol.limit).toBe(15);
        expect((component as any).cdr.detectChanges).toHaveBeenCalled();
      });

      it('should log error to console if API fails', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        apiSpy.updateColumn.mockReturnValue(throwError(() => new Error('API Error')));

        component.updateLimit(mockCol, 20);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
    

    describe('dropColumn', () => {
        

        it('should reorder columns and call updateColumnOrder with correct mapping', () => {

            component.columns = [
                { id: 'col-1', title: 'A' },
                { id: 'col-2', title: 'B' },
                { id: 'col-3', title: 'C' }
            ];
    
            const mockEvent: any = {
            previousIndex: 0,
            currentIndex: 2
            };

            apiSpy.updateColumnOrder.mockReturnValue(of({}));

            component.dropColumn(mockEvent);

            expect(component.columns[2].id).toBe('col-1');
            expect(component.columns[0].id).toBe('col-2');
            expect(component.columns[1].id).toBe('col-3');  

            const expectedOrder = [
                { id: 'col-2', order: 0 },
                { id: 'col-3', order: 1 },
                { id: 'col-1', order: 2 }
            ];
        
            expect(apiSpy.updateColumnOrder).toHaveBeenCalledWith(expectedOrder);
        });
    });
    
    describe('removeColumn', () => {
      beforeEach(() => {
        apiSpy.deleteColumn.mockReturnValue(of({}));
        vi.spyOn(component, 'loadBoard').mockImplementation(() => {});
      });

      it('should call deleteColumn and reload board when user confirms', () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const loadBoardSpy = vi.spyOn(component, 'loadBoard');

        component.removeColumn(123);

        expect(confirmSpy).toHaveBeenCalledWith("Delete column?");
        expect(apiSpy.deleteColumn).toHaveBeenCalledWith(123);
        expect(loadBoardSpy).toHaveBeenCalled();

        confirmSpy.mockRestore();
      });

      it('should NOT call deleteColumn when user cancels', () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

        component.removeColumn(123);

        expect(apiSpy.deleteColumn).not.toHaveBeenCalled();
    
        confirmSpy.mockRestore();
      });
    });
    
  });

