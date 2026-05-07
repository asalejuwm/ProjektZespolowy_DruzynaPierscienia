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

;

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

  
  it.only('should display column titles and WIP limits', async () => {
    const mockColumns = [{ id: 1, title: 'Do zrobienia', limit: 5, header_color: '#3b82f6' }];
    
    apiSpy.getTasks.mockReturnValue(of({ 
      users: [], 
      tasks: [], 
      columns: mockColumns, 
      swimlanes: [] 
    }));

    fixture.detectChanges();
    await fixture.whenStable();

    component.columns = mockColumns;
    fixture.detectChanges();

    const headerTitle = fixture.debugElement.query(By.css('.column-header h2'));
    const wipDisplay = fixture.debugElement.query(By.css('.wip-limit-display'));

    expect(headerTitle.nativeElement.textContent).toContain('Do zrobienia');
    expect(wipDisplay.nativeElement.textContent).toContain('5');
  });

  it('should call toggleEditMenu when column settings button is clicked', async () => {
    const mockColumns = [{ id: 1, title: 'Test Col', limit: 0 }];
    
    apiSpy.getTasks.mockReturnValue(of({ users: [], tasks: [], columns: mockColumns, swimlanes: [] }));

    fixture.detectChanges();
    await fixture.whenStable();

    component.columns = mockColumns;
    fixture.detectChanges();

    const settingsBtn = fixture.debugElement.query(By.css('.header-actions .icon-btn'));
    expect(settingsBtn,'Nie znaleziono przycisku ustawień kolumny').toBeTruthy();
    
    settingsBtn.triggerEventHandler('click', { stopPropagation: () => {}, preventDefault: () => {} });
    fixture.detectChanges();

    expect(component.activeEditMenu!.id).toBe(1);
    expect(component.activeEditMenu!.type).toBe('column');
  });

  it('should call toggleTaskCompletion when checkbox is toggled', async () => {
    const mockCols = [{ id: 1, title: 'Col' }];
    const mockSwims = [{ id: 1, name: 'Swim' }];
    const mockTasks = [{ id: 99, content: 'Zadanie', is_completed: false, column_id: 1, swimlane_id: 1 }];
    
    apiSpy.getTasks.mockReturnValue(of({ 
      users: [], 
      tasks: mockTasks, 
      columns: mockCols, 
      swimlanes: mockSwims 
    }));
    apiSpy.updateTask.mockReturnValue(of({}));

    fixture.detectChanges();
    await fixture.whenStable();

    component.columns = mockCols;
    component.swimlanes = mockSwims;
    vi.spyOn(component, 'getTasksForCell').mockReturnValue(mockTasks);
    
    fixture.detectChanges();

    const checkbox = fixture.debugElement.query(By.css('input[type="checkbox"]'));
    expect(checkbox,'Nie znaleziono checkboxa zadania').toBeTruthy();
    
    checkbox.nativeElement.click();
    fixture.detectChanges();

    expect(apiSpy.updateTask).toHaveBeenCalled();
  });

  describe('AppComponent - Edit Swimlane Popover', () => {

  it('should render swimlane edit popover with correct data', async () => {
    const mockSwimlane = { id: 5, name: 'Projekt Alfa', limit: 10 };
    
    component.activeEditMenu = { type: 'swimlane', id: 5 };
    
    vi.spyOn(component, 'getActiveSwimlane').mockReturnValue(mockSwimlane as any);


    fixture.detectChanges();
    await fixture.whenStable();


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

    mockTask = {
      id: 101,
      content: 'Główne zadanie',
      subtasks: [
        { id: 1, content: 'Subtask 1', is_completed: false },
        { id: 2, content: 'Subtask 2', is_completed: true }
      ]
    };

    apiSpy.updateTask.mockReturnValue(of({}));
    apiSpy.updateSubtask.mockReturnValue(of({}));
    apiSpy.addSubtask.mockReturnValue(of({ id: 3, content: 'Nowy', is_completed: false }));
    apiSpy.deleteSubtask.mockReturnValue(of({}));

    vi.spyOn(component, 'getActiveTask').mockReturnValue(mockTask);
  });

  it('should render the task content and the list of subtasks', async () => {
    component.activeEditMenu = { type: 'task', id: 101 };
    
    fixture.detectChanges();
    await fixture.whenStable();

    const popover = fixture.debugElement.query(By.css('.edit-popover')).nativeElement;
    expect(popover).toBeTruthy();

    const mainInput = fixture.debugElement.query(By.css('.edit-popover input:not([type="number"])'));
    expect(mainInput).toBeTruthy();

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

    const subtaskSpan = fixture.debugElement.query(By.css('.subtask-edit-row span'));
    subtaskSpan.nativeElement.dispatchEvent(new MouseEvent('dblclick'));
    
    fixture.detectChanges();

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

    expect(addInputDebugEl,'Nie znaleziono inputa nowej podzadania').toBeTruthy();
    expect(addBtnDebugEl, 'Nie znaleziono przycisku Add').toBeTruthy();

    const addInput = addInputDebugEl.nativeElement;
    const addBtn = addBtnDebugEl.nativeElement;

    const addSpy = vi.spyOn(component, 'addSubtask');
  
    addInput.value = 'Kupić mleko';
    addInput.dispatchEvent(new Event('input'));
  
    fixture.detectChanges();

    addBtn.click();
  
    fixture.detectChanges();
    await fixture.whenStable();

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

  component.activeEditMenu = { type: 'task', id: 101 };

  vi.spyOn(component, 'getActiveTask').mockReturnValue(mockTask);
  
  const saveSpy = vi.spyOn(component, 'saveTaskContent');


  fixture.detectChanges();
  await fixture.whenStable();


  const inputDebugEl = fixture.debugElement.query(By.css('.edit-popover > input'));
  

  expect(inputDebugEl,'Nie znaleziono głównego inputa edycji zadania').toBeTruthy();
  
  const inputHtmlEl = inputDebugEl.nativeElement;

  inputHtmlEl.value = 'Enter Test';
  inputHtmlEl.dispatchEvent(new Event('input')); // Aktualizuje referencję #editTaskContent
  
  fixture.detectChanges();


  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true
  });
  inputHtmlEl.dispatchEvent(enterEvent);

  fixture.detectChanges();
  await fixture.whenStable();

  expect(saveSpy).toHaveBeenCalledWith(mockTask, 'Enter Test');
});
});

describe('AppComponent - Task Users Assignment Popover', () => {
  let mockTask: any;
  let mockUsers: any[];

  beforeEach(() => {
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

    component.allUsers = mockUsers;
    vi.spyOn(component, 'getActiveTask').mockReturnValue(mockTask);
    
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

