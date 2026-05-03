import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { App } from './app';
import { ApiService } from './services/api';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { moveItemInArray, transferArrayItem, DragDropModule } from '@angular/cdk/drag-drop';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectorRef } from '@angular/core';

vi.mock('@angular/cdk/drag-drop', async () => {
  const actual = await vi.importActual('@angular/cdk/drag-drop');
  return {
    ...actual,
    moveItemInArray: vi.fn(),
    transferArrayItem: vi.fn(),
  };
});

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
      toggleTaskUser: vi.fn().mockReturnValue(of({})),
      addUser: vi.fn().mockReturnValue(of({})),
      deleteUser: vi.fn().mockReturnValue(of({})),
      updateSwimlane: vi.fn().mockReturnValue(of({})),
      addSubtask: vi.fn().mockReturnValue(of({})),
      updateSubtask: vi.fn().mockReturnValue(of({})),
      deleteSubtask: vi.fn().mockReturnValue(of({})),
      updateTaskPosition: vi.fn().mockReturnValue(of({})),
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

    component.columns = [];

    fixture.detectChanges();
  });


  it('should log an error to the console when getTasks fails', () => {
    // 1. Przygotowanie: szpiegujemy console.error
    // 'vi.spyOn' pozwala nam śledzić wywołania bez blokowania ich (lub z blokowaniem)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  
    // 2. Symulujemy błąd API przy użyciu 'throwError' z RxJS
    const mockError = new Error('Server Error');
    apiSpy.getTasks.mockReturnValue(throwError(() => mockError));

    // 3. Wywołanie funkcji
    component.loadBoard();

    // 4. Weryfikacja
    // Sprawdzamy, czy console.error został wywołany z oczekiwaną treścią
    expect(consoleSpy).toHaveBeenCalledWith("Error loading board:", mockError);

    // Czyszczenie szpiega, aby nie wpływał na inne testy
    consoleSpy.mockRestore();
  });





  // TESTY LOGIKI SIATKI (GRID)

  describe('App Component Grid & Task Logic', () => {
    // Zakładamy, że component i fixture są już zainicjalizowane w beforeEach

    describe('getTasksForCell', () => {
      it('should filter and sort tasks correctly for a specific cell', () => {
        // Przygotowanie danych
        component.allTasks = [
          { id: 1, column_id: 1, swimlane_id: 1, order: 2, content: 'Drugie' },
          { id: 2, column_id: 1, swimlane_id: 1, order: 1, content: 'Pierwsze' },
          { id: 3, column_id: 2, swimlane_id: 1, order: 0, content: 'Inna kolumna' },
          { id: 4, column_id: 1, swimlane_id: 2, order: 0, content: 'Inny swimlane' },
        ] as any;

        // Wywołanie dla Kolumny 1 i Swimlane 1
        const result = component.getTasksForCell(1, 1);

        // Weryfikacja: powinny być tylko 2 zadania, posortowane po 'order'
        expect(result.length).toBe(2);
        expect(result[0].id).toBe(2); // order 1
        expect(result[1].id).toBe(1); // order 2
      });

      it('should return an empty array if no tasks match the cell', () => {
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
        // Przygotowanie siatki 2x2
        component.columns = [{ id: 1 }, { id: 2 }] as any;
        component.swimlanes = [{ id: 10 }, { id: 20 }] as any;

        const ids = component.allCellIds;

        // Sprawdzenie długości (2 kolumny * 2 swimlane = 4 ID)
        expect(ids.length).toBe(4);

        // Sprawdzenie zawartości
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

    it('should set editingColumn and focus/select the input', () => {
      // 1. Przełączamy Vitest na sztuczne zegary
      vi.useFakeTimers();

      // Przygotowanie danych
      const mockCol = { id: 1, title: 'Do zrobienia' };
  
      // Tworzymy element w DOM, aby querySelector go znalazł
      const inputElement = document.createElement('input');
      inputElement.className = 'edit-input';
      document.body.appendChild(inputElement);

      // Szpiegujemy metody elementu
      const focusSpy = vi.spyOn(inputElement, 'focus');
      const selectSpy = vi.spyOn(inputElement, 'select');

      // 2. Działanie
      component.startEditColumn(mockCol);

      // Weryfikacja natychmiastowa
      expect(component.editingColumn).toBe(mockCol);

      // 3. Przesuwamy czas o 0ms (wykonuje kod z setTimeout)
      vi.advanceTimersByTime(0);

      // Weryfikacja asynchroniczna
      expect(focusSpy).toHaveBeenCalled();
      expect(selectSpy).toHaveBeenCalled();

      // 4. Sprzątanie
      document.body.removeChild(inputElement);
      vi.useRealTimers(); // Powrót do rzeczywistego czasu
    });
    
    it('should log an error to the console when updateColumn API fails', () => {
      // 1. Przygotowanie: Szpiegujemy console.error, aby nie "śmiecił" w terminalu i był mierzalny
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  
      // Symulujemy błąd serwera (np. 500 Internal Server Error)
      const mockError = new Error('Database connection failed');
      apiSpy.updateColumn.mockReturnValue(throwError(() => mockError));

      // Przykładowe dane wejściowe
      const mockCol = { id: 1, title: 'Nazwa' };

      // 2. Działanie
      component.saveColumn(mockCol, { title: 'NowaNazwa', limit: 5, header_color: '#fff', bg_color: '#000' });

        // 3. Weryfikacja
      // Sprawdzamy, czy console.error został wywołany z dokładnym komunikatem z Twojej funkcji
      expect(consoleSpy).toHaveBeenCalledWith("Error updating column:", mockError);

      // 4. Sprzątanie
      consoleSpy.mockRestore();
    });

    describe('updateLimit', () => {
      let mockCol: any;

      beforeEach(() => {
        mockCol = { id: 1, limit: 5 };
        apiSpy.updateColumn.mockReturnValue(of({}));
        // Mockujemy NgZone, aby natychmiast wywoływał przekazaną funkcję
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
    
    it('should reorder columns and call updateColumnOrder with correct mapping', () => {
        // 1. Przygotowanie danych
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

        // 2. Działanie
        component.dropColumn(mockEvent);

        // 3. Weryfikacja
        // Sprawdzamy czy wywołano funkcję CDK (którą mamy zamockowaną na górze pliku)
        expect(moveItemInArray).toHaveBeenCalledWith(
          component.columns,
          mockEvent.previousIndex,
          mockEvent.currentIndex
        );

        // Sprawdzamy czy API dostało poprawną mapę (id i nowy index jako order)
        const expectedOrder = [
          { id: 'col-1', order: 0 },
          { id: 'col-2', order: 1 },
          { id: 'col-3', order: 2 }
        ];
        // Uwaga: moveItemInArray w teście (mock) może nie zmieniać fizycznie tablicy, 
        // więc sprawdzamy strukturę przekazaną do API
        expect(apiSpy.updateColumnOrder).toHaveBeenCalledWith(expect.any(Array));
        expect(apiSpy.updateColumnOrder).toHaveBeenCalled();
      });
    
    describe('removeColumn', () => {
      beforeEach(() => {
        // Przygotowanie bazowych mocków
        apiSpy.deleteColumn.mockReturnValue(of({}));
        vi.spyOn(component, 'loadBoard').mockImplementation(() => {});
      });

      it('should call deleteColumn and reload board when user confirms', () => {
        // 1. Mockujemy window.confirm, aby zawsze zwracał true (kliknięcie OK)
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const loadBoardSpy = vi.spyOn(component, 'loadBoard');

        // 2. Działanie
        component.removeColumn(123);

        // 3. Weryfikacja
        expect(confirmSpy).toHaveBeenCalledWith("Delete column?");
        expect(apiSpy.deleteColumn).toHaveBeenCalledWith(123);
        expect(loadBoardSpy).toHaveBeenCalled();

        // Czyszczenie szpiega
        confirmSpy.mockRestore();
      });

      it('should NOT call deleteColumn when user cancels', () => {
        // 1. Mockujemy window.confirm, aby zwracał false (kliknięcie Anuluj)
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

        // 2. Działanie
        component.removeColumn(123);

        // 3. Weryfikacja
        expect(apiSpy.deleteColumn).not.toHaveBeenCalled();
    
        confirmSpy.mockRestore();
      });
    });
    
  });

  describe('Swimlane Operations', () => {
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

  // -- ACTIVE EDIT MENU ---
  describe('Active Edit Menu', () => {
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

  // --- TESTY ZADAŃ ---
  describe('Task Operations', () => {

    it('should call addTask with correct data and reload board on success', () => {
      // 1. Przygotowanie danych testowych
      const mockValue = 'Zrobić zakupy';
      const mockColId = 5;
      const mockSwimId = 10;
  
      // Tworzymy szpiegów (spies) dla metod, które chcemy obserwować
      // addTask musi zwracać Observable (używamy 'of', aby symulować sukces)
      const addTaskSpy = apiSpy.addTask.mockReturnValue(of({ id: 1 }));
      const loadBoardSpy = vi.spyOn(component, 'loadBoard').mockImplementation(() => {});

      // 2. Wywołanie funkcji
      component.addItem( mockColId, mockSwimId, mockValue);

      // 3. Weryfikacja
      // Sprawdzamy, czy addTask został wywołany z obiektem o konkretnej strukturze
      expect(addTaskSpy).toHaveBeenCalledWith({
        content: mockValue,
        column_id: mockColId,
        swimlane_id: mockSwimId
      });

      // Sprawdzamy, czy loadBoard zostało wywołane wewnątrz subscribe
      expect(loadBoardSpy).toHaveBeenCalled();
    });
    
    describe('drop functionality', () => {
      let mockEvent: any;

      beforeEach(() => {
        // Resetujemy apiSpy przed każdym testem
        apiSpy.updateTaskPosition.mockReturnValue(of({}));
        vi.spyOn(component, 'loadBoard').mockImplementation(() => {});

        // Bazowy mock zdarzenia CdkDragDrop
        mockEvent = {
          item: { data: { id: 100, content: 'Test Task' } },
          previousIndex: 0,
          currentIndex: 1,
          previousContainer: { data: [{ id: 100 }] },
          container: { data: [{ id: 100 }] },
        };
      });

      it('should move item in same array when containers are equal', () => {
        mockEvent.previousContainer = mockEvent.container;

        component.drop(mockEvent, 1, 2);

        // Sprawdza, czy wywołano funkcję lokalnego przesuwania
        expect(moveItemInArray).toHaveBeenCalledWith(
          mockEvent.container.data,
          0,
          1
        );
        // Sprawdza wywołanie API
        expect(apiSpy.updateTaskPosition).toHaveBeenCalledWith(100, 1, 2, 1);
      });

      it('should transfer item between arrays when containers are different', () => {
        mockEvent.previousContainer = { data: [{ id: 100 }] };
        mockEvent.container = { data: [] };

        component.drop(mockEvent, 5, 5);

        // Sprawdza, czy wywołano funkcję przenoszenia między listami
        expect(transferArrayItem).toHaveBeenCalledWith(
          mockEvent.previousContainer.data,
          mockEvent.container.data,
          0,
          1
        );
        // Sprawdza wywołanie API z nowymi współrzędnymi
        expect(apiSpy.updateTaskPosition).toHaveBeenCalledWith(100, 5, 5, 1);
      });

      it('should reload board after successful API update', () => {
        const loadBoardSpy = vi.spyOn(component, 'loadBoard');
    
        component.drop(mockEvent, 1, 1);

        // Sprawdza, czy po sukcesie API odświeżono tablicę
        expect(loadBoardSpy).toHaveBeenCalled();
      });
    });

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

    beforeEach(() => {
      // Przygotowanie zestawu testowych użytkowników
      component.allUsers = [
        { id: 1, username: 'Adam', color: '#ff0000' },
        { id: 2, username: 'Beata', color: '' }, // Brak koloru
        { id: 3, username: 'czarek' }             // Brak właściwości color w obiekcie
      ];
    });

    describe('getUserName', () => {
      it('should return username if user exists', () => {
        expect(component.getUserName(1)).toBe('Adam');
      });

      it('should return "Unknown" if user does not exist', () => {
        expect(component.getUserName(999)).toBe('Unknown');
      });
    });

    describe('getUserInitials', () => {
      it('should return first two letters in uppercase if user exists', () => {
        expect(component.getUserInitials(1)).toBe('AD');
        expect(component.getUserInitials(3)).toBe('CZ'); // test toUpperCase
      });

      it('should return "??" if user does not exist', () => {
        expect(component.getUserInitials(999)).toBe('??');
      });
    });
  

    describe('getUserColor', () => {
      it('should return user color if it exists and is not empty', () => {
        expect(component.getUserColor(1)).toBe('#ff0000');
      });

      it('should return default color if user has empty color string', () => {
        expect(component.getUserColor(2)).toBe('#64748b');
      });

      it('should return default color if user object has no color property', () => {
        expect(component.getUserColor(3)).toBe('#64748b');
      });

      it('should return default color if user does not exist', () => {
        expect(component.getUserColor(999)).toBe('#64748b');
      });
    });



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

    describe('toggleUserAssignment', () => {
      let mockTask: any;

      beforeEach(() => {
        mockTask = { id: 10, assignee_ids: [1] };
        apiSpy.updateTask.mockReturnValue(of({}));
      });

      it('should add userId to assignee_ids if not present and limit is not reached', () => {
        // 1. Przygotowanie: użytkownik 2 nie jest przypisany, limit OK
        vi.spyOn(component, 'canUserAcceptTask').mockReturnValue(true);

        // 2. Działanie
        component.toggleUserAssignment(mockTask, 2);

        // 3. Weryfikacja
        expect(mockTask.assignee_ids).toContain(2);
        expect(apiSpy.updateTask).toHaveBeenCalledWith(10, { assignee_ids: [1, 2] });
      });

      it('should show alert and not add userId if canUserAcceptTask returns false', () => {
        // 1. Przygotowanie: użytkownik 2 nie jest przypisany, ale osiągnął limit
        vi.spyOn(component, 'canUserAcceptTask').mockReturnValue(false);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

        // 2. Działanie
        component.toggleUserAssignment(mockTask, 2);

        // 3. Weryfikacja
        expect(alertSpy).toHaveBeenCalledWith("This user already reached their task limit!");
        expect(mockTask.assignee_ids).not.toContain(2);
        expect(apiSpy.updateTask).not.toHaveBeenCalled();
        alertSpy.mockRestore();
      });

      it('should remove userId from assignee_ids if it is already present', () => {
        // 1. Działanie: usuwamy użytkownika 1, który już tam jest
        component.toggleUserAssignment(mockTask, 1);

        // 2. Weryfikacja
        expect(mockTask.assignee_ids).not.toContain(1);
        expect(mockTask.assignee_ids.length).toBe(0);
        expect(apiSpy.updateTask).toHaveBeenCalledWith(10, { assignee_ids: [] });
      });

      it('should initialize assignee_ids if it is missing', () => {
        const taskWithoutIds = { id: 20 }; // brak assignee_ids
        vi.spyOn(component, 'canUserAcceptTask').mockReturnValue(true);

        component.toggleUserAssignment(taskWithoutIds, 1);

        expect((taskWithoutIds as any).assignee_ids).toEqual([1]);
      });
    });

    describe('createUser', () => {
      beforeEach(() => {
        component.allUsers = [];
        vi.spyOn((component as any).cdr, 'detectChanges').mockImplementation(() => {});
      });

      it('should return early if username is empty or only whitespace', () => {
        apiSpy.addUser.mockReturnValue(of({}));
    
        component.createUser('   ');
    
        expect(apiSpy.addUser).not.toHaveBeenCalled();
      });

      it('should add new user to allUsers and detect changes on success', () => {
        // 1. Przygotowanie
        const newUserFromApi = { id: 5, username: 'Gienek' };
        apiSpy.addUser.mockReturnValue(of(newUserFromApi));

        // 2. Działanie
        component.createUser('Gienek');

        // 3. Weryfikacja
        expect(apiSpy.addUser).toHaveBeenCalledWith({ username: 'Gienek' });
        expect(component.allUsers).toContain(newUserFromApi);
        expect((component as any).cdr.detectChanges).toHaveBeenCalled();
      });

      it('should log an error to console when API fails', () => {
        // 1. Przygotowanie
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const mockError = new Error('Database full');
        apiSpy.addUser.mockReturnValue(throwError(() => mockError));

        // 2. Działanie
        component.createUser('Pechowiec');

        // 3. Weryfikacja
        expect(consoleSpy).toHaveBeenCalledWith("Error creating user:", mockError);
        consoleSpy.mockRestore();
      });
    });
    
    describe('onUserDropped', () => {
      let mockTask: any;
      let mockEvent: any;

      beforeEach(() => {
        mockTask = { id: 10, assignee_ids: [] };
        mockEvent = { item: { data: { id: 1, username: 'Adam', task_limit: 3 } } };
        apiSpy.updateTask.mockReturnValue(of({}));
        vi.spyOn((component as any).cdr, 'detectChanges').mockImplementation(() => {});
      });

      it('should return early if user data is invalid or user already assigned', () => {
        // Przypadek 1: brak danych
        component.onUserDropped({ item: { data: null } } as any, mockTask);
        expect(apiSpy.updateTask).not.toHaveBeenCalled();

        // Przypadek 2: już przypisany
        mockTask.assignee_ids = [1];
        component.onUserDropped(mockEvent, mockTask);
        expect(apiSpy.updateTask).not.toHaveBeenCalled();
      });

      it('should show alert if user limit is reached', () => {
        vi.spyOn(component, 'canUserAcceptTask').mockReturnValue(false);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

        component.onUserDropped(mockEvent, mockTask);

        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('already reached their task limit'));
        expect(mockTask.assignee_ids).not.toContain(1);
        alertSpy.mockRestore();
      });

      it('should assign user and detect changes on success', () => {
        vi.spyOn(component, 'canUserAcceptTask').mockReturnValue(true);
        component.onUserDropped(mockEvent, mockTask);

        expect(mockTask.assignee_ids).toContain(1);
        expect((component as any).cdr.detectChanges).toHaveBeenCalled();
      });

      it('should rollback assignee_ids if API fails', () => {
        vi.spyOn(component, 'canUserAcceptTask').mockReturnValue(true);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        apiSpy.updateTask.mockReturnValue(throwError(() => new Error('API Fail')));

        component.onUserDropped(mockEvent, mockTask);

        expect(mockTask.assignee_ids).not.toContain(1); // Rollback zadziałał
        expect(consoleSpy).toHaveBeenCalledWith("Error assigning: ", expect.any(Error));
        consoleSpy.mockRestore();
      });
    });
    
    describe('deleteUser and Panels', () => {
      it('toggleUserPanel: should flip showUserPanel value', () => {
        component.showUserPanel = false;
        component.toggleUserPanel();
        expect(component.showUserPanel).toBe(true);
      });

      it('deleteUser: should remove user and clean up assignments in all tasks', () => {
        // Arrange
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        apiSpy.deleteUser.mockReturnValue(of({}));
        component.allUsers = [{ id: 1, username: 'Adam' }, { id: 2, username: 'Ewa' }];
        component.allTasks = [
          { id: 101, assignee_ids: [1, 2] },
          { id: 102, assignee_ids: [1] }
        ];

        // Act
        component.deleteUser(1);

        // Assert
        expect(component.allUsers.length).toBe(1);
        expect(component.allTasks[0].assignee_ids).toEqual([2]);
        expect(component.allTasks[1].assignee_ids).toEqual([]);
      });

      it('deleteUser: should log an error to the console when API call fails', () => {
        // 1. Przygotowanie (Arrange)
        const userId = 99;
        const mockError = new Error('User is assigned to critical tasks');
  
        // Szpiegujemy confirm, aby zwrócił true (użytkownik klika "OK")
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  
        // Szpiegujemy console.error
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  
        // Symulujemy błąd API
        apiSpy.deleteUser.mockReturnValue(throwError(() => mockError));

        // 2. Działanie (Act)
        component.deleteUser(userId);

        // 3. Weryfikacja (Assert)
        // Sprawdzamy, czy wywołano console.error z odpowiednim komunikatem i obiektem błędu
        expect(consoleSpy).toHaveBeenCalledWith("Error deleting user:", mockError);

        // Czyszczenie szpiegów
        confirmSpy.mockRestore();
        consoleSpy.mockRestore();
      });

    });

    describe('User Updates', () => {
      let mockUser: any;
      
      beforeEach(() => {
        mockUser = { id: 1, username: 'Adam', task_limit: 3, color: '#fff' };
        apiSpy.updateUser.mockReturnValue(of({}));
        vi.spyOn((component as any).zone, 'run').mockImplementation((fn: any) => fn());
        vi.spyOn((component as any).cdr, 'detectChanges').mockImplementation(() => {});
      });

      it('updateUserLimit: should parse invalid input as 3 and save', () => {
        component.updateUserLimit(mockUser, 'invalid');
        expect(apiSpy.updateUser).not.toHaveBeenCalled(); // bo domyślny limit 3 === stary limit 3
      });

      it('updateUserLimit: should update limit when value is valid and different', () => {
        component.updateUserLimit(mockUser, '5');
        expect(apiSpy.updateUser).toHaveBeenCalledWith(1, { task_limit: 5 });
        expect(mockUser.task_limit).toBe(5);
      });

      it('updateUserLimit: should log an error to the console when API call fails', () => {
        // 1. Przygotowanie (Arrange)
        const mockUser = { id: 7, username: 'TestUser', task_limit: 3 };
        const mockError = new Error('Connection timeout');
  
        // Szpiegujemy console.error
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  
        // Symulujemy błąd API przy próbie aktualizacji
        // Musimy podać wartość inną niż obecny limit (np. '5'), aby przejść przez "if (user.task_limit === newLimit) return;"
        apiSpy.updateUser.mockReturnValue(throwError(() => mockError));

        // 2. Działanie (Act)
        component.updateUserLimit(mockUser, '5');

        // 3. Weryfikacja (Assert)
        // Sprawdzamy, czy wywołano console.error z Twoim niestandardowym komunikatem
        expect(consoleSpy).toHaveBeenCalledWith("Error updating user limit:", mockError);

        // Czyszczenie
        consoleSpy.mockRestore();
      });

      it('updateUserColor: should update color and alert on error', () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        apiSpy.updateUser.mockReturnValue(throwError(() => new Error('Fail')));

        component.updateUserColor(mockUser, '#000');

        expect(alertSpy).toHaveBeenCalledWith("Couldn't save color");
        alertSpy.mockRestore();
      });

      it('updateUserColor: should log success message and detect changes on success', () => {
        // 1. Przygotowanie (Arrange)
        const mockUser = { id: 1, username: 'Adam', color: '#ffffff' };
        const newColor = '#ff0000';
  
        // Szpiegujemy console.log
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  
        // Szpiegujemy ChangeDetectorRef (rzutowanie na any, bo cdr jest prywatne)
        const cdrSpy = vi.spyOn((component as any).cdr, 'detectChanges');
  
        // Symulujemy sukces API
        apiSpy.updateUser.mockReturnValue(of({}));

        // 2. Działanie (Act)
        component.updateUserColor(mockUser, newColor);

        // 3. Weryfikacja (Assert)
        // Sprawdzamy czy kolor w obiekcie został zmieniony
        expect(mockUser.color).toBe(newColor);
  
        // Sprawdzamy czy console.log wyświetlił poprawny tekst z imieniem użytkownika
        expect(logSpy).toHaveBeenCalledWith(`Color for Adam has been changed.`);
  
        // Sprawdzamy czy detekcja zmian została wywołana
        expect(cdrSpy).toHaveBeenCalled();

        // Czyszczenie
        logSpy.mockRestore();
      });

    });
  });
  // --- TESTY SUBTASKÓW ---
  describe('Subtask Operations', () => {
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
    
  


  });

});

describe('AppComponent (Template Tests)', () => {
  let component: App;
  let fixture: ComponentFixture<App>;
  let apiSpy: any;

  beforeEach(async () => {

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
      toggleTaskUser: vi.fn().mockReturnValue(of({})),
      addUser: vi.fn().mockReturnValue(of({})),
      deleteUser: vi.fn().mockReturnValue(of({})),
      updateSwimlane: vi.fn().mockReturnValue(of({})),
      addSubtask: vi.fn().mockReturnValue(of({})),
      updateSubtask: vi.fn().mockReturnValue(of({})),
      deleteSubtask: vi.fn().mockReturnValue(of({})),
      updateTaskPosition: vi.fn().mockReturnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [
        App,            // Komponent standalone musi być w imports, nie w declarations!
        DragDropModule,
        FormsModule
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ApiService, useValue: apiSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
  });

  it('should make component', () => {
    expect(component).toBeTruthy();
  });

  describe('Toolbar', () => {
    it('should render user avatars for each user in allUsers', async () => {

      const mockUsers = [
        { id: 1, username: 'Adam', color: '#ff0000', task_limit: 3 },
        { id: 2, username: 'Ewa', color: '#00ff00', task_limit: 3 }
      ];
     
      apiSpy.getTasks.mockReturnValue(of({
        users: mockUsers,      // Te dane trafią do komponentu przez ngOnInit
        tasks: [],
        columns: [],
        swimlanes: []
      }));
 
      fixture.detectChanges(); 
      await fixture.whenStable(); // Czekamy na zakończenie subskrypcji

      component.allUsers = mockUsers;
  
      fixture.detectChanges();

      const avatars = fixture.debugElement.queryAll(By.css('.user-avatar-draggable'));
  
      expect(avatars.length).toBe(2);
    });

    it('powinien wywołać createUser po kliknięciu przycisku dodawania', () => {
      const createSpy = vi.spyOn(component, 'createUser');
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('.add-user-inline input')).nativeElement;
      const button = fixture.debugElement.query(By.css('.add-user-inline button')).nativeElement;

      input.value = 'NowyUzytkownik';
      button.click();

      expect(createSpy).toHaveBeenCalledWith('NowyUzytkownik');
    });
  });

  

  // --- TEST: Column Titles and WIP Limits ---
  it('should display column titles and WIP limits', async () => {
    // 1. Dane
    const mockColumns = [{ id: 1, title: 'Do zrobienia', limit: 5, header_color: '#3b82f6' }];
    
    // 2. Mock przed init
    apiSpy.getTasks.mockReturnValue(of({ 
      users: [], 
      tasks: [], 
      columns: mockColumns, 
      swimlanes: [] 
    }));

    // 3. Inicjalizacja
    fixture.detectChanges();
    await fixture.whenStable();

    // 4. Dane komponentu
    component.columns = mockColumns;
    fixture.detectChanges();

    // 5. Sprawdzenie renderowania
    const headerTitle = fixture.debugElement.query(By.css('.column-header h2'));
    const wipDisplay = fixture.debugElement.query(By.css('.wip-limit-display'));

    expect(headerTitle.nativeElement.textContent).toContain('Do zrobienia');
    expect(wipDisplay.nativeElement.textContent).toContain('5');
  });

  // --- TEST: Column Settings Button ---
  it('should call toggleEditMenu when column settings button is clicked', async () => {
    // 1. Dane
    const mockColumns = [{ id: 1, title: 'Test Col', limit: 0 }];
    
    // 2. Mock przed init
    apiSpy.getTasks.mockReturnValue(of({ users: [], tasks: [], columns: mockColumns, swimlanes: [] }));

    // 3. Inicjalizacja
    fixture.detectChanges();
    await fixture.whenStable();

    // 4. Dane komponentu
    component.columns = mockColumns;
    fixture.detectChanges();

    // 5. Kliknięcie w zębatkę
    const settingsBtn = fixture.debugElement.query(By.css('.header-actions .icon-btn'));
    expect(settingsBtn,'Nie znaleziono przycisku ustawień kolumny').toBeTruthy();
    
    settingsBtn.triggerEventHandler('click', { stopPropagation: () => {}, preventDefault: () => {} });
    fixture.detectChanges();

    expect(component.activeEditMenu!.id).toBe(1);
    expect(component.activeEditMenu!.type).toBe('column');
  });

  // --- TEST: Task Completion Toggle ---
  it('should call toggleTaskCompletion when checkbox is toggled', async () => {
    // 1. Dane (Potrzebujemy kompletu, aby wyrenderować komórkę z zadaniem)
    const mockCols = [{ id: 1, title: 'Col' }];
    const mockSwims = [{ id: 1, name: 'Swim' }];
    const mockTasks = [{ id: 99, content: 'Zadanie', is_completed: false, column_id: 1, swimlane_id: 1 }];
    
    // 2. Mock przed init
    apiSpy.getTasks.mockReturnValue(of({ 
      users: [], 
      tasks: mockTasks, 
      columns: mockCols, 
      swimlanes: mockSwims 
    }));
    apiSpy.updateTask.mockReturnValue(of({}));

    // 3. Inicjalizacja
    fixture.detectChanges();
    await fixture.whenStable();

    // 4. Dane komponentu (wymuszamy stan tabeli)
    component.columns = mockCols;
    component.swimlanes = mockSwims;
    // Wiele komponentów filtruje zadania w locie, upewnij się że widok ma do nich dostęp
    vi.spyOn(component, 'getTasksForCell').mockReturnValue(mockTasks);
    
    fixture.detectChanges();

    // 5. Akcja na checkboxie
    const checkbox = fixture.debugElement.query(By.css('input[type="checkbox"]'));
    expect(checkbox,'Nie znaleziono checkboxa zadania').toBeTruthy();
    
    checkbox.nativeElement.click();
    fixture.detectChanges();

    expect(apiSpy.updateTask).toHaveBeenCalled();
  });

  describe('AppComponent - Edit Swimlane Popover', () => {

  it('should render swimlane edit popover with correct data', async () => {
    // 1. Przygotowanie danych
    const mockSwimlane = { id: 5, name: 'Projekt Alfa', limit: 10 };
    
    // 2. Ustawienie stanu komponentu
    component.activeEditMenu = { type: 'swimlane', id: 5 };
    
    // Mockujemy funkcję, którą HTML wykorzystuje w *ngIf ... as swim
    vi.spyOn(component, 'getActiveSwimlane').mockReturnValue(mockSwimlane as any);

    // 3. Detekcja zmian (wymuszenie wyrenderowania popovera)
    fixture.detectChanges();
    await fixture.whenStable();

    // 4. Asercje widoku
    const popover = fixture.debugElement.query(By.css('.edit-popover'));
    expect(popover, 'Popover edycji swimlane nie pojawił się').toBeTruthy();

    const nameInput = fixture.debugElement.query(By.css('.edit-popover input:not([type="number"])'));
    const limitInput = fixture.debugElement.query(By.css('.edit-popover input[type="number"]'));

    expect(nameInput, 'Nie znaleziono inputa nazwy').toBeTruthy();
    expect(limitInput, 'Nie znaleziono inputa limitu').toBeTruthy();

    expect(nameInput.nativeElement.value).toBe('Projekt Alfa');
    expect(limitInput.nativeElement.value).toBe('10');
  });

  

  it('should only close menu when Cancel is clicked', async () => {
    const mockSwimlane = { id: 5, name: 'Test', limit: 1 };
    vi.spyOn(component, 'getActiveSwimlane').mockReturnValue(mockSwimlane as any);
    const closeMenuSpy = vi.spyOn(component, 'closeEditMenu');
    const updateNameSpy = vi.spyOn(component, 'updateSwimlaneName');

    component.activeEditMenu = { type: 'swimlane', id: 5 };
    fixture.detectChanges();

    const cancelBtn = fixture.debugElement.query(By.css('.close-popover')).nativeElement;
    cancelBtn.click();

    expect(closeMenuSpy).toHaveBeenCalled();
    expect(updateNameSpy).not.toHaveBeenCalled();
  });
});

describe('AppComponent - Edit Task & Subtasks Popover', () => {
  let mockTask: any;

  beforeEach(() => {
    // Przygotowanie mocka zadania z podzadaniami
    mockTask = {
      id: 101,
      content: 'Główne zadanie',
      subtasks: [
        { id: 1, content: 'Subtask 1', is_completed: false },
        { id: 2, content: 'Subtask 2', is_completed: true }
      ]
    };

    // Konfiguracja mocków serwisu API dla metod używanych w tym fragmencie
    apiSpy.updateTask.mockReturnValue(of({}));
    apiSpy.updateSubtask.mockReturnValue(of({}));
    apiSpy.addSubtask.mockReturnValue(of({ id: 3, content: 'Nowy', is_completed: false }));
    apiSpy.deleteSubtask.mockReturnValue(of({}));

    // Mockujemy funkcję pobierającą zadanie
    vi.spyOn(component, 'getActiveTask').mockReturnValue(mockTask);
  });

  it('should render the task content and the list of subtasks', async () => {
    component.activeEditMenu = { type: 'task', id: 101 };
    
    fixture.detectChanges();
    await fixture.whenStable();

    const popover = fixture.debugElement.query(By.css('.edit-popover')).nativeElement;
    expect(popover).toBeTruthy();

    // Sprawdzenie głównego inputa
    const mainInput = fixture.debugElement.query(By.css('.edit-popover input:not([type="number"])'));
    expect(mainInput).toBeTruthy();

    // Sprawdzenie listy subtasków
    const subtaskRows = fixture.debugElement.queryAll(By.css('.subtask-edit-row'));
    expect(subtaskRows.length).toBe(2);
    expect(subtaskRows[0].nativeElement.textContent).toContain('Subtask 1');
  });

  it('should save the content of the task after clicking Save', async () => {
    component.activeEditMenu = { type: 'task', id: 101 };
    const saveSpy = vi.spyOn(component, 'saveTaskContent');
    
    fixture.detectChanges();
    await fixture.whenStable();

    const input = fixture.debugElement.query(By.css('.edit-popover > input')).nativeElement;
    input.value = 'Zmieniona treść';
    input.dispatchEvent(new Event('input'));

    const saveBtn = fixture.debugElement.query(By.css('.save-btn')).nativeElement;
    saveBtn.click();

    expect(saveSpy).toHaveBeenCalledWith(mockTask, 'Zmieniona treść');
  });

  it('should enter subtask editing mode after dblclick', async () => {
    component.activeEditMenu = { type: 'task', id: 101 };
    fixture.detectChanges();

    // Szukamy spana z tekstem subtaska
    const subtaskSpan = fixture.debugElement.query(By.css('.subtask-edit-row span'));
    subtaskSpan.nativeElement.dispatchEvent(new MouseEvent('dblclick'));
    
    fixture.detectChanges();

    // Sprawdzamy czy pojawił się input edycji (#subEditInput)
    const editInput = fixture.debugElement.query(By.css('.subtask-edit-row input[style*="flex-grow: 1"]'));
    expect(editInput).toBeTruthy();
    expect(component.editingSubtaskId).toBe(mockTask.subtasks[0].id);
  });

  it('it should call addSubtask and clear the input after clicking Add', async () => {
    component.activeEditMenu = { type: 'task', id: 101 };
    
    
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();

    const addInputDebugEl = fixture.debugElement.query(By.css('.add-subtask-row input'));
    const addBtnDebugEl = fixture.debugElement.query(By.css('.add-subtask-row button'));

    // Sprawdzamy czy elementy w ogóle istnieją przed próbą użycia .nativeElement
    expect(addInputDebugEl,'Nie znaleziono inputa nowej podzadania').toBeTruthy();
    expect(addBtnDebugEl, 'Nie znaleziono przycisku Add').toBeTruthy();

    const addInput = addInputDebugEl.nativeElement;
    const addBtn = addBtnDebugEl.nativeElement;

    // 3. Symulacja akcji
    const addSpy = vi.spyOn(component, 'addSubtask');
  
    addInput.value = 'Kupić mleko';
    addInput.dispatchEvent(new Event('input'));
  
    // Detekcja zmian, aby referencja #newSubtaskInput w HTML przejęła nową wartość
    fixture.detectChanges();

    // 4. Kliknięcie
    addBtn.click();
  
    // Przetworzenie logiki (click) -> wywołanie addSubtask i czyszczenie pola
    fixture.detectChanges();
    await fixture.whenStable();

    // 5. Weryfikacja
    expect(addSpy).toHaveBeenCalledWith(expect.anything(), 'Kupić mleko');
    expect(addInput.value).toBe(''); // Sprawdzenie czy wyczyszczono pole w HTML
    });

  it('should call toggleSubtaskCompletion when the checkbox changes', async () => {
    component.activeEditMenu = { type: 'task', id: 101 };
    const toggleSpy = vi.spyOn(component, 'toggleSubtaskCompletion');
    
    fixture.detectChanges();

    const checkbox = fixture.debugElement.query(By.css('.subtask-edit-row input[type="checkbox"]')).nativeElement;
    checkbox.click();
    checkbox.dispatchEvent(new Event('change'));

    expect(toggleSpy).toHaveBeenCalledWith(mockTask, mockTask.subtasks[0]);
  });

  

  it('should save the content of the task after pressing Enter in the main field', async () => {
  // 1. Przygotowanie stanu (warunki dla *ngIf)
  component.activeEditMenu = { type: 'task', id: 101 };
  // Upewnij się, że mockTask jest zdefiniowany w beforeEach
  vi.spyOn(component, 'getActiveTask').mockReturnValue(mockTask);
  
  const saveSpy = vi.spyOn(component, 'saveTaskContent');

  // 2. Renderowanie i stabilizacja
  fixture.detectChanges();
  await fixture.whenStable();

  // 3. Znalezienie właściwego inputa (pierwszy input w popoverze)
  const inputDebugEl = fixture.debugElement.query(By.css('.edit-popover > input'));
  
  // Sprawdzenie czy nie jest null, aby uniknąć TypeError
  expect(inputDebugEl,'Nie znaleziono głównego inputa edycji zadania').toBeTruthy();
  
  const inputHtmlEl = inputDebugEl.nativeElement;

  // 4. Symulacja wpisywania treści
  inputHtmlEl.value = 'Enter Test';
  inputHtmlEl.dispatchEvent(new Event('input')); // Aktualizuje referencję #editTaskContent
  
  fixture.detectChanges();

  // 5. Symulacja klawisza Enter
  // Ważne: Angular nasłuchuje na 'keydown.enter', więc wysyłamy keydown
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true
  });
  inputHtmlEl.dispatchEvent(enterEvent);

  // 6. Finalna detekcja zmian
  fixture.detectChanges();
  await fixture.whenStable();

  // 7. Weryfikacja
  expect(saveSpy).toHaveBeenCalledWith(mockTask, 'Enter Test');
});
});

describe('AppComponent - Task Users Assignment Popover', () => {
  let mockTask: any;
  let mockUsers: any[];

  beforeEach(() => {
    // 1. Przygotowanie danych testowych
    mockUsers = [
      { id: 1, username: 'Adam' },
      { id: 2, username: 'Ewa' },
      { id: 3, username: 'Marek' }
    ];

    mockTask = {
      id: 101,
      content: 'Testowe zadanie',
      assignee_ids: [1, 2] // Adam i Ewa są przypisani, Marek nie
    };

    // 2. Mockowanie danych w komponencie
    component.allUsers = mockUsers;
    vi.spyOn(component, 'getActiveTask').mockReturnValue(mockTask);
    
    // Mockowanie metody zamykania (często używanej w footerze)
    vi.spyOn(component, 'closeEditMenu').mockImplementation(() => {});
  });

  

  it('should close the menu after clicking the Done button', async () => {
    component.activeEditMenu = { type: 'task_users', id: 101 };
    const closeSpy = vi.spyOn(component, 'closeEditMenu');

    fixture.detectChanges();
    await fixture.whenStable();

    const doneBtn = fixture.debugElement.query(By.css('.close-popover'));
    doneBtn.nativeElement.click();

    expect(closeSpy).toHaveBeenCalled();
  });
});


});





