import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from './services/api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, CdkDrag, CdkDropList],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  // 1. Zaczynamy od pustej tablicy 
  columns: any[] = [];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  // --- Zmienne do obsługi edycji i limitów ---
editingColumn: any = null;
editingTask: { col: any, index: number } | null = null;

IMMUTABLE_COLUMNS = ['To do', 'Done'];

isImmutable(col: any): boolean {
  return this.IMMUTABLE_COLUMNS.includes(col.title);
}

// --- Funkcje pomocnicze ---

isOverLimit(col: any) {
  // Jeśli limit jest <= 0, uznajemy, że limitu nie ma 
  if (col.limit <= 0) return false; 
  return col.items && col.items.length > col.limit;
}

startEditColumn(col: any) {
  this.editingColumn = col;
}

saveColumnTitle(col: any, value: string) {
  const newTitle = value.trim();
  if (newTitle) {
    this.api.updateColumn(col.id, { title: newTitle }).subscribe(() => {
      col.title = newTitle;
      this.editingColumn = null;
    });
  } else {
    this.editingColumn = null;
  }
}

startEditTask(col: any, index: number) {
  this.editingTask = { col, index };
}

saveTask(col: any, index: number, value: string) {
  const newValue = value.trim();
  const task = col.items[index];

  if (newValue && newValue !== task.content) {
    this.api.updateTask(task.id, { content: newValue }).subscribe({
      next: (response) => {
        console.log('Zadanie zaktualizowane:', response);
        this.loadBoard();
      },
      error: (err) => {
        console.error('Błąd podczas aktualizacji zadania:', err);
      }
    });
  }

  this.editingTask = null;
}

  ngOnInit(): void {
    console.log("Inicjalizacja aplikacji...");
    this.loadBoard();
  }

  loadBoard() {
    this.api.getTasks().subscribe({
      next: (data) => {
        this.columns = data;
        this.cdr.detectChanges();
        console.log("Dane załadowane i detekcja wymuszona:", data);
      },
      error: (err) => console.error("Błąd:", err)
    });
  }

  drop(event: CdkDragDrop<any[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }

    const task = event.container.data[event.currentIndex];
    const newColumnId = event.container.id;

    this.api.updateTaskPosition(task.id, newColumnId, event.currentIndex).subscribe();
  }

  addItem(col: any, text: string) {
    const value = text.trim();
    if (!value) return;

    this.api.addTask({ content: value, column_id: col.id }).subscribe(() => {
      this.loadBoard();
    });
  }

  removeItem(col: any, index: number) {
    const item = col.items[index];
    if (!confirm(`Czy na pewno chcesz usunąć zadanie: "${item.content}"?`)) return;

    this.api.deleteTask(item.id).subscribe(() => {
      this.loadBoard();
    });
  }

  // --- LOGIKA KOLUMN ---

  addColumn() {
    const title = prompt("Nazwa nowej kolumny:");
    if (!title) return;
  
    if (this.columns.some(col => col.title.toLowerCase() === title.toLowerCase())) {
      alert('Kolumna o takiej nazwie już istnieje!');
      return;
    }

    this.api.addColumn({ title: title }).subscribe({
      next: (response) => {
        console.log("Kolumna dodana pomyślnie", response);
        this.loadBoard(); 
      },
      error: (err) => console.error("Błąd dodawania kolumny", err)
    });
  }

  removeColumn(colId: number) {
    if (confirm("Czy na pewno usunąć kolumnę?")) {
      this.api.deleteColumn(colId).subscribe({
        next: () => {
          this.loadBoard(); 
        },
        error: (err) => {
          console.error("Nie udało się usunąć kolumny:", err);
        }
      });
    }
  }

  updateLimit(col: any, value: string) {
    const num = value === '∞' || value === '' ? -1 : Number(value);
    this.api.updateColumn(col.id, { limit: num }).subscribe(() => {
      this.loadBoard();
    });
  }

  dropColumn(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.columns, event.previousIndex, event.currentIndex);
  
    const newOrder = this.columns.map((col, index) => ({ id: col.id, order: index }));
    
    this.api.updateColumnOrder(newOrder).subscribe();
  }

  get connectedLists() {
    return this.columns.map(c => c.id.toString());
  }
}