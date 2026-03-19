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
  columns: any[] = [];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  // --- Variables for handling editing and limits  ---
editingColumn: any = null;
editingTask: { col: any, index: number } | null = null;

IMMUTABLE_COLUMNS = ['To do', 'Done'];

isImmutable(col: any): boolean {
  return this.IMMUTABLE_COLUMNS.includes(col.title);
}

// --- Auxiliary functions ---

isOverLimit(col: any) {
  if (col.limit <= 0) return false; 
  return col.items && col.items.length > col.limit;
}

startEditColumn(col: any) {
  this.editingColumn = col;
  
  setTimeout(() => {
    const input = document.querySelector('.edit-input') as HTMLInputElement;
    if (input) {
      input.focus();
      input.select(); 
    }
  }, 0);
}

saveColumnTitle(col: any, value: string) {
  if (this.editingColumn !== col) return;

  const newTitle = value.trim();

  if (!newTitle || newTitle === col.title) {
    this.editingColumn = null;
    return;
  }

  const isDuplicate = this.columns.some(c => 
    c.id !== col.id && c.title.toLowerCase() === newTitle.toLowerCase()
  );

  if (isDuplicate) {
    this.editingColumn = null; 
    alert(`Column "${newTitle}" already exists!`);
    return;
  }

  this.api.updateColumn(col.id, { title: newTitle }).subscribe({
    next: () => {
      col.title = newTitle;
      this.editingColumn = null;
      this.loadBoard();
    },
    error: (err) => {
      console.error('Error:', err);
      this.editingColumn = null;
      this.loadBoard();
    }
  });
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
        console.log('Task updated:', response);
        this.loadBoard();
      },
      error: (err) => {
        console.error('Task update error: ', err);
      }
    });
  }

  this.editingTask = null;
}

  ngOnInit(): void {
    console.log("Initializing application...");
    this.loadBoard();
  }

  loadBoard() {
    this.api.getTasks().subscribe({
      next: (data) => {
        this.columns = data;
        this.cdr.detectChanges();
        console.log("Data loaded and detection forced:", data);
      },
      error: (err) => console.error("Error:", err)
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
    if (!confirm(`Are you sure you want to remove task: "${item.content}"?`)) return;

    this.api.deleteTask(item.id).subscribe(() => {
      this.loadBoard();
    });
  }

  // --- COLUMN LOGIC ---

  addColumn() {
    const title = prompt("New column name:");
    if (!title) return;
  
    if (this.columns.some(col => col.title.toLowerCase() === title.toLowerCase())) {
      alert('This column already exists!');
      return;
    }

    this.api.addColumn({ title: title, limit: 5 }).subscribe({
      next: (response) => {
        console.log("Column added successfully", response);
        this.loadBoard(); 
      },
      error: (err) => console.error("Error adding column", err)
    });
  }

  removeColumn(colId: number) {
    if (confirm("Are you sure you want to delete the column?")) {
      this.api.deleteColumn(colId).subscribe({
        next: () => {
          this.loadBoard(); 
        },
        error: (err) => {
          console.error("Couldn't delete column:", err);
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