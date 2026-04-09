import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDragPlaceholder,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from './services/api';
import { take } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, CdkDrag, CdkDropList, CdkDragPlaceholder],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  columns: any[] = [];
  swimlanes: any[] = []; // NOWE: lista osób/wierszy
  allTasks: any[] = [];  // NOWE: płaska lista wszystkich zadań
  allUsers: any[] = [];
  showUserPanel: boolean = false;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef, private zone: NgZone) { }

  editingColumn: any = null;
  editingTask: { taskId: number } | null = null; // Zmiana: teraz bazujemy na ID zadania
  IMMUTABLE_COLUMNS = ['To do', 'Done'];

  ngOnInit(): void {
    this.loadBoard();
  }

  loadBoard() {
    this.api.getTasks().pipe(take(1)).subscribe({
      next: (data: any) => {
        this.zone.run(() => {
          // Zakładamy, że backend zwraca teraz obiekt: { columns: [], swimlanes: [], tasks: [] }
          this.columns = data.columns || [];
          this.swimlanes = data.swimlanes || [];
          this.allTasks = data.tasks || [];
          this.allUsers = data.users || [];
          this.cdr.detectChanges();
        });
      },
      error: (err) => console.error("Error loading board:", err)
    });
  }

  // --- LOGIKA SIATKI (GRID) ---

  // Pobiera zadania tylko dla konkretnej komórki (np. "Ania" w "In Progress")
  getTasksForCell(colId: number, swimId: number) {
    return this.allTasks
      .filter(t => t.column_id === colId && t.swimlane_id === swimId)
      .sort((a, b) => a.order - b.order);
  }

  // Tworzy unikalne ID dla każdej listy w siatce (potrzebne dla Drag & Drop)
  getCellId(colId: number, swimId: number): string {
    return `cell-${colId}-${swimId}`;
  }

  // Zwraca listę wszystkich ID komórek, żeby zadania mogły "latać" między nimi
  get allCellIds(): string[] {
    const ids: string[] = [];
    this.columns.forEach(c => {
      this.swimlanes.forEach(s => ids.push(this.getCellId(c.id, s.id)));
    });
    return ids;
  }

  // --- AKCJE ZADAŃ ---

  drop(event: CdkDragDrop<any[]>, targetColId: number, targetSwimId: number) {
    const task = event.item.data; // Zadanie, które trzymamy
    const newIndex = event.currentIndex;

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, newIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        newIndex
      );
    }

    // Informujemy backend o nowym położeniu: Kolumna, Wiersz i Pozycja w liście
    this.api.updateTaskPosition(task.id, targetColId, targetSwimId, newIndex).pipe(take(1)).subscribe({
      next: () => this.loadBoard()
    });
  }

  addItem(colId: number, swimId: number, text: string) {
    const value = text.trim();
    if (!value) return;

    this.api.addTask({
      content: value,
      column_id: colId,
      swimlane_id: swimId
    }).subscribe(() => this.loadBoard());
  }

  removeItem(taskId: number) {
    if (!confirm(`Are you sure you want to remove this task?`)) return;
    this.api.deleteTask(taskId).pipe(take(1)).subscribe(() => this.loadBoard());
  }

  // --- LOGIKA EDYCJI I LIMITÓW (Zaktualizowana) ---

  isImmutable(col: any): boolean {
    return this.IMMUTABLE_COLUMNS.includes(col.title?.trim());
  }

  isOverLimit(col: any): boolean {
    if (!col || !this.allTasks || !this.swimlanes) return false;

    const limit = Number(col.limit);
    if (isNaN(limit) || limit <= 0) return false;

    // Pobierz listę ID aktywnych wierszy
    const activeSwimlaneIds = this.swimlanes.map(s => String(s.id));

    // Licz tylko zadania, które należą do tej kolumny ORAZ do jednego z widocznych wierszy
    const count = this.allTasks.filter(t =>
      String(t.column_id) === String(col.id) &&
      activeSwimlaneIds.includes(String(t.swimlane_id))
    ).length;

    return count > limit;
  }

  startEditColumn(col: any) {
    this.editingColumn = col;
    setTimeout(() => {
      const input = document.querySelector('.edit-input') as HTMLInputElement;
      if (input) { input.focus(); input.select(); }
    }, 0);
  }

  saveColumn(col: any, data: { title: string, limit: any, header_color: string, bg_color: string }) {
    // Parsujemy, a potem sprawdzamy czy nie jest NaN lub mniejsze od 0
    let parsedLimit = parseInt(data.limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      parsedLimit = 0;
    }
  
    const payload = {
      title: data.title.trim(),
      limit: parsedLimit, // Używamy zweryfikowanej liczby
      header_color: data.header_color,
      bg_color: data.bg_color
    };
  
    this.api.updateColumn(col.id, payload).pipe(take(1)).subscribe({
      next: () => {
        this.zone.run(() => {
          // Aktualizacja lokalna
          col.title = payload.title;
          col.limit = payload.limit;
          col.header_color = payload.header_color;
          col.bg_color = payload.bg_color;
  
          this.cdr.detectChanges();
          this.loadBoard(); // Odświeżenie danych
        });
      },
      error: (err) => console.error("Error updating column:", err)
    });
  }

  // --- COLUMN CRUD ---

  addColumn() {
    const title = prompt("New column name:");
    if (!title) return;
    this.api.addColumn({ title, limit: 5 }).pipe(take(1)).subscribe(() => this.loadBoard());
  }

  removeColumn(colId: number) {
    if (confirm("Delete column?")) {
      this.api.deleteColumn(colId).pipe(take(1)).subscribe(() => this.loadBoard());
    }
  }

  updateLimit(col: any, limit: any) {
    let newLimit = parseInt(limit, 10);
    if (isNaN(newLimit)) return;

    // Blokada wartości ujemnych
    if (newLimit < 0) newLimit = 0;

    this.api.updateColumn(col.id, { limit: newLimit })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.zone.run(() => {
            col.limit = newLimit;
            this.cdr.detectChanges();
          });
        },
        error: (err) => console.error(err)
      });
  }

  dropColumn(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.columns, event.previousIndex, event.currentIndex);
    const newOrder = this.columns.map((col, index) => ({ id: col.id, order: index }));
    this.api.updateColumnOrder(newOrder).pipe(take(1)).subscribe();
  }



  getContrastColor(hexColor: string): string {
    if (!hexColor) return '#1e293b'; // Domyślny ciemny tekst

    // Usuń '#' jeśli jest obecny
    const hex = hexColor.replace('#', '');

    // Konwersja HEX na RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Obliczanie jasności (standard YIQ)
    // Formula: (R*299 + G*587 + B*114) / 1000
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    // Jeśli jasność >= 128, dajemy ciemny tekst, w przeciwnym razie biały
    return (yiq >= 128) ? '#1e293b' : '#ffffff';
  }

  // ROWS

  addSwimlane() {
    const name = prompt("New row name:");
    if (!name) return;
    this.api.addSwimlane({ name }).pipe(take(1)).subscribe({
      next: () => {
        this.loadBoard(); // Odświeża dane z backendu
      },
      error: (err) => console.error("Error while adding row:", err)
    });
  }

  removeSwimlane(swimId: number) {
    if (confirm("Are you sure you want to delete this row? The tasks will be moved to the first available row.")) {
      this.api.deleteSwimlane(swimId).subscribe({
        next: () => {
          this.loadBoard();
        },
        error: (err) => {
          alert(err.error?.error || "An error occurred while deleting.");
        }
      });
    }
  }

  isSwimlaneOverLimit(swim: any): boolean {
    if (swim.limit <= 0) return false;
    const count = this.allTasks.filter(t => t.swimlane_id === swim.id).length;
    return count > swim.limit;
  }

  updateSwimlaneLimit(swim: any, limit: any) {
    let newLimit = parseInt(limit, 10);
    if (isNaN(newLimit)) return;

    // Blokada wartości ujemnych
    if (newLimit < 0) newLimit = 0;

    this.api.updateSwimlane(swim.id, { limit: newLimit })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.zone.run(() => {
            swim.limit = newLimit;
            this.cdr.detectChanges();
          });
        },
        error: (err) => console.error(err)
      });
  }

  updateSwimlaneName(swim: any) {
    this.api.updateSwimlane(swim.id, { name: swim.name }).pipe(take(1)).subscribe({
      next: () => console.log('Name updated'),
      error: (err) => console.error(err)
    });
  }

  activeEditMenu: { type: string, id: number } | null = null;

  getActiveColumn() {
    return this.columns.find(c => c.id === this.activeEditMenu?.id);
  }

  getActiveSwimlane() {
    return this.swimlanes.find(s => s.id === this.activeEditMenu?.id);
  }

  getActiveTask() {
    return this.allTasks.find(t => t.id === this.activeEditMenu?.id);
  }

  toggleEditMenu(type: 'column' | 'swimlane' | 'task' | 'task_users', id: number, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    console.log(`Trying to open menu for: ${type}, ID: ${id}`);

    if (this.activeEditMenu?.id === id && this.activeEditMenu?.type === type) {
      this.activeEditMenu = null;
    } else {
      this.activeEditMenu = { type, id };
    }
  }

  closeEditMenu() {
    this.activeEditMenu = null;
  }

  saveTaskContent(task: any, newContent: string) {
    const content = newContent.trim();
    if (!content || content === task.content) {
      this.closeEditMenu();
      return;
    }

    this.api.updateTask(task.id, { content: content })
      .pipe(take(1))
      .subscribe({
        next: () => {
          task.content = content;
          this.closeEditMenu();
          this.cdr.detectChanges(); // Odśwież widok lokalnie
        },
        error: (err) => console.error("Error updating task:", err)
      });
  }

  // Users

  getUserName(userId: number): string {
    const user = this.allUsers.find(u => u.id === userId);
    return user ? user.username : 'Unknown';
  }

  getUserInitials(userId: number) {
    const user = this.allUsers.find(u => u.id === userId);
    return user ? user.username.substring(0, 2).toUpperCase() : '??';
  }

  getUserColor(userId: number): string {
    const user = this.allUsers.find(u => u.id === userId);
    return user && user.color ? user.color : '#64748b';
  }

  canUserAcceptTask(userId: number): boolean {
    const user = this.allUsers.find(u => u.id === userId);
    if (!user) return false;
  
    const currentCount = this.getUserTaskCount(userId);
    const limit = user.task_limit || 3;
  
    return currentCount < limit;
  }

  toggleUserAssignment(task: any, userId: number) {
    if (!task.assignee_ids) task.assignee_ids = [];

    const isCurrentlyAssigned = task.assignee_ids.includes(userId);

    if (!isCurrentlyAssigned) {
      if (!this.canUserAcceptTask(userId)) {
        alert("This user already reached their task limit!");
        return;
      }
      task.assignee_ids.push(userId);
    } else {
      const index = task.assignee_ids.indexOf(userId);
      task.assignee_ids.splice(index, 1);
    }

    this.api.updateTask(task.id, { assignee_ids: task.assignee_ids }).subscribe();
  }

  createUser(username: string) {
    if (!username.trim()) return;
    this.api.addUser({ username }).pipe(take(1)).subscribe({
      next: (newUser) => {
        const userWithDefaults = {
          ...newUser,
          color: '#64748b',
          task_limit: 3
          };
        this.allUsers.push(newUser);
        this.cdr.detectChanges();
      },
      error: (err) => console.error("Error creating user:", err)
    });
  }

  getUserTaskCount(userId: number): number {
    return this.allTasks.filter(t => t.assignee_ids && t.assignee_ids.includes(userId)).length;
  }

  get allTaskDropIds(): string[] {
    return this.allTasks.map(t => 'task-' + t.id);
  }

  onUserDropped(event: CdkDragDrop<any>, task: any) {
    const user = event.item.data;

    if (!user || user.username === undefined) return;

    if (!task.assignee_ids) task.assignee_ids = [];
    if (task.assignee_ids.includes(user.id)) return;

    if (!this.canUserAcceptTask(user.id)) {
      alert(`User ${user.username} already reached their task limit (${user.task_limit || 3})!`);
      return;
    }

    task.assignee_ids.push(user.id);
    
    this.api.updateTask(task.id, { assignee_ids: task.assignee_ids }).subscribe({
      next: () => this.cdr.detectChanges(),
      error: (err) => {
        console.error("Error assigning: ", err);
        task.assignee_ids = task.assignee_ids.filter((id: number) => id !== user.id);
      }
    });

    //event.source._dragRef.reset();
  }
  toggleUserPanel() {
    this.showUserPanel = !this.showUserPanel;
  }

  deleteUser(userId: number) {
    if (!confirm('Are you sure you want to delete this user? Their assignments will also be cancelled')) return;
    
    // Zakładając, że masz / zrobisz metodę deleteUser w pliku API
    this.api.deleteUser(userId).pipe(take(1)).subscribe({
      next: () => {
        // Optymistyczna aktualizacja UI
        this.allUsers = this.allUsers.filter(u => u.id !== userId);
        
        // Zaktualizuj zadania u przypisanego użytkownika, żeby nie wysypało frontu
        this.allTasks.forEach(t => {
          if (t.assignee_ids) {
            t.assignee_ids = t.assignee_ids.filter((id: number) => id !== userId);
          }
        });
        this.cdr.detectChanges();
      },
      error: (err) => console.error("Error deleting user:", err)
    });
  }

  updateUserLimit(user: any, newLimitStr: string) {
    let newLimit = parseInt(newLimitStr, 10);
    if (isNaN(newLimit) || newLimit < 1) newLimit = 3;

    // Sprawdzamy czy w ogóle nastąpiła zmiana
    if (user.task_limit === newLimit) return;

    // Zakładając, że masz / zrobisz metodę updateUser w pliku API
    this.api.updateUser(user.id, { task_limit: newLimit }).pipe(take(1)).subscribe({
      next: () => {
        this.zone.run(() => {
          user.task_limit = newLimit;
          this.cdr.detectChanges();
        });
      },
      error: (err) => console.error("Error updating user limit:", err)
    });
  }

  updateUserColor(user: any, newColor: string) {
    user.color = newColor;
    this.api.updateUser(user.id, { color: newColor }).pipe(take(1)).subscribe({
      next: () => {
        console.log(`Color for ${user.username} has been changed.`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error saving color: ', err);
        alert("Couldn't save color");
      }
    });
  }

}
