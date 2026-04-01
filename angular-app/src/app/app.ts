import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Component, OnInit, ChangeDetectorRef, NgZone} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from './services/api';
import { take } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, CdkDrag, CdkDropList],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  columns: any[] = [];
  swimlanes: any[] = []; // NOWE: lista osób/wierszy
  allTasks: any[] = [];  // NOWE: płaska lista wszystkich zadań

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
    return this.IMMUTABLE_COLUMNS.includes(col.title);
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

  saveColumnTitle(col: any, value: string) {
    if (this.editingColumn !== col) return;
    const newTitle = value.trim();
    if (newTitle && newTitle !== col.title) {
      this.api.updateColumn(col.id, { title: newTitle }).pipe(take(1)).subscribe(() => {
        col.title = newTitle; // Aktualizacja lokalna
        this.cdr.detectChanges(); // <--- DODAJ TO
        this.loadBoard();
      });
    }
    this.editingColumn = null;
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
      next: () => console.log('Nazwa zaktualizowana'),
      error: (err) => console.error(err)
    });
  }

  activeEditMenu: { type: string, id: number } | null = null;

  toggleEditMenu(type: 'column' | 'swimlane' | 'task', id: number, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    console.log(`Próba otwarcia menu dla: ${type}, ID: ${id}`);

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
}
