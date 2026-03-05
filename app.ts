import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, CdkDrag, CdkDropList],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {

  columns = [
    {
      id: 'todo',
      title: 'To do',
      limit: 3,
      items: ['Get to work', 'Pick up groceries', 'Go home', 'Fall asleep']
    },
    {
      id: 'done',
      title: 'Done',
      limit: 3,
      items: ['Get up', 'Brush teeth', 'Take a shower', 'Check e-mail', 'Walk dog']
    }
  ];

  drop(event: CdkDragDrop<string[]>) {
  const targetCol = this.columns.find(c => c.id === event.container.id);

  const willExceed =
    targetCol &&
    event.previousContainer !== event.container &&
    targetCol.items.length + 1 > targetCol.limit;

  // Standardowe przenoszenie
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

  if (willExceed) {
    alert(`Przekroczono WIP limit (${targetCol.limit}) w kolumnie "${targetCol.title}".`);
  }
}

  addColumn() {
    this.columns.push({
      id: 'col-' + Math.random().toString(36).substring(2),
      title: 'New list',
      limit: 3,
      items: []
    });
  }

  addItem(col: any, text: string) {
  const value = text.trim();
  if (!value) return;

  const willExceed = col.items.length + 1 > col.limit;

  col.items = [...col.items, value];

  if (willExceed) {
    alert(`Przekroczono WIP limit (${col.limit}) w kolumnie "${col.title}".`);
  }
}

  isOverLimit(col: any) {
  return col.items.length > col.limit;
}

updateLimit(col: any, value: string) {
  if (value === '∞' || value === '' || value === '-1') {
    col.limit = Infinity;
    return;
  }

  const num = Number(value);
  if (isNaN(num) || num <= 0) {
    alert("Limit musi być liczbą większą od zera lub ∞.");
    return;
  }

  col.limit = num;
}


removeColumn(index: number) {
  const col = this.columns[index];

  const ok = confirm(
    col.items.length > 0
      ? `Kolumna "${col.title}" zawiera zadania. Czy chcesz ją usunąć i przenieść zadania do poprzedniej kolumny?`
      : `Czy na pewno chcesz usunąć kolumnę "${col.title}"?`
  );

  if (!ok) return;

  if (col.items.length > 0) {
    if (index > 0) {
      this.columns[index - 1].items.push(...col.items);
    } else if (this.columns.length > 1) {
      this.columns[index + 1].items.push(...col.items);
    }
  }

  this.columns.splice(index, 1);
}
editingColumn: any = null;
editingTask: { col: any, index: number } | null = null;

startEditColumn(col: any) {
  this.editingColumn = col;
}

saveColumnTitle(col: any, value: string) {
  const newTitle = value.trim();
  if (newTitle) col.title = newTitle;
  this.editingColumn = null;
}

startEditTask(col: any, index: number) {
  this.editingTask = { col, index };
}

saveTask(col: any, index: number, value: string) {
  const newValue = value.trim();
  if (newValue) col.items[index] = newValue;
  this.editingTask = null;
}



  removeItem(col: any, index: number) {
  const item = col.items[index];
  const ok = confirm(`Czy na pewno chcesz usunąć zadanie: "${item}"?`);

  if (!ok) return;

  col.items.splice(index, 1);
}

  get connectedLists() {
    return this.columns.map(c => c.id);
  }
}
