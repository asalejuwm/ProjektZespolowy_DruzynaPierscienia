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
import { Observable, forkJoin } from 'rxjs';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, CdkDrag, CdkDropList, CdkDragPlaceholder],
  templateUrl: './app.html',
  template: '<div>Mock Template</div>',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  columns: any[] = [];
  swimlanes: any[] = [];
  allTasks: any[] = [];
  allUsers: any[] = [];
  showUserPanel: boolean = false;
  isAdding: { [key: string]: boolean } = {};

  constructor(private api: ApiService, private cdr: ChangeDetectorRef, private zone: NgZone) { }

  editingColumn: any = null;
  editingTask: { taskId: number } | null = null;
  IMMUTABLE_COLUMNS = ['To do', 'Done'];
  editingSubtaskId: number | null = null;

  ngOnInit(): void {
    this.loadBoard();
  }

  loadBoard() {
    this.api.getTasks().pipe(take(1)).subscribe({
      next: (data: any) => {
        this.zone.run(() => {
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

  getTasksForCell(colId: number, swimId: number) {
    return this.allTasks
      .filter(t => t.column_id === colId && t.swimlane_id === swimId)
      .sort((a, b) => a.order - b.order);
  }

  getCellId(colId: number, swimId: number): string {
    return `cell-${colId}-${swimId}`;
  }

  get allCellIds(): string[] {
    const ids: string[] = [];
    this.columns.forEach(c => {
      this.swimlanes.forEach(s => ids.push(this.getCellId(c.id, s.id)));
    });
    return ids;
  }

  // --- AKCJE ZADAŃ ---

  drop(event: CdkDragDrop<any[]>, targetColId: number, targetSwimId: number) {
    const task = event.item.data;

    if (!task || task.username) {
      return;
    }

    const newIndex = event.currentIndex;

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, newIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, newIndex);
    }

    const statusUpdate$ = this.checkTaskCompletion(task);
    const positionUpdate$ = this.api.updateTaskPosition(task.id, targetColId, targetSwimId, newIndex);

    const requests = [positionUpdate$];
    if (statusUpdate$) requests.push(statusUpdate$);

    forkJoin(requests).pipe(take(1)).subscribe({
      next: () => {
        console.log('Wszystko zapisane, odświeżam...');
        this.loadBoard();
      }
    });
  }

  addItem(colId: number, swimId: number, text: string) {
    const value = text.trim();
    const cellId = this.getCellId(colId, swimId);

    if (!value) {
      this.isAdding[cellId] = false; // Zamknij jeśli puste
      return;
    }

    this.api.addTask({
      content: value,
      column_id: colId,
      swimlane_id: swimId
    }).subscribe(() => {
      this.isAdding[cellId] = false; // Zamknij po sukcesie
      this.loadBoard();
    });
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

    const activeSwimlaneIds = this.swimlanes.map(s => String(s.id));

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
    let parsedLimit = parseInt(data.limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      parsedLimit = 0;
    }

    const payload = {
      title: data.title.trim(),
      limit: parsedLimit,
      header_color: data.header_color,
      bg_color: data.bg_color
    };

    this.api.updateColumn(col.id, payload).pipe(take(1)).subscribe({
      next: () => {
        this.zone.run(() => {
          col.title = payload.title;
          col.limit = payload.limit;
          col.header_color = payload.header_color;
          col.bg_color = payload.bg_color;

          this.cdr.detectChanges();
          this.loadBoard();
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
    if (!hexColor) return '#1e293b';

    const hex = hexColor.replace('#', '');

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    return (yiq >= 128) ? '#1e293b' : '#ffffff';
  }

  // ROWS

  addSwimlane() {
    const name = prompt("New row name:");
    if (!name) return;
    this.api.addSwimlane({ name }).pipe(take(1)).subscribe({
      next: () => {
        this.loadBoard();
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
          this.cdr.detectChanges();
        },
        error: (err) => console.error("Error updating task:", err)
      });
  }

  // Users

  getUserName(userId: number): string {
    const user = this.allUsers.find(u => u.id === userId);
    return user ? user.username : 'Unknown';
  }

  getUserInitials(userId: number): string {
    const user = this.allUsers?.find(u => u.id === userId);
    if (!user || !user.username) return '??';
    return user?.username ? user.username.substring(0, 2).toUpperCase() : '??';
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
    return this.allTasks.map(t => `task-${t.id}`);
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

    this.api.deleteUser(userId).pipe(take(1)).subscribe({
      next: () => {
        this.allUsers = this.allUsers.filter(u => u.id !== userId);

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

    if (user.task_limit === newLimit) return;

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

  // --- ZADANIA (Checkboxy) ---
  toggleTaskCompletion(task: any, forceState?: boolean) {
    const newState = forceState !== undefined ? forceState : !task.is_completed;

    if (task.is_completed === newState) return;

    this.api.updateTask(task.id, { is_completed: newState }).pipe(take(1)).subscribe(() => {
      this.zone.run(() => {
        task.is_completed = newState;
        this.cdr.detectChanges();
      });
    });
  }

  // --- SUBTASKI ---
  addSubtask(task: any, content: string) {
    if (!content.trim()) return;
    this.api.addSubtask(task.id, content).pipe(take(1)).subscribe((newSubtask) => {
      this.zone.run(() => {
        if (!task.subtasks) task.subtasks = [];

        task.subtasks.push(newSubtask);
        this.checkTaskCompletion(task);
        this.cdr.detectChanges();
      });
    });
  }

  toggleSubtaskCompletion(task: any, subtask: any) {
    const newState = !subtask.is_completed;

    this.api.updateSubtask(subtask.id, { is_completed: newState }).pipe(take(1)).subscribe(() => {
      this.zone.run(() => {
        subtask.is_completed = newState;

        const allCompleted = task.subtasks && task.subtasks.length > 0 && task.subtasks.every((s: any) => s.is_completed);

        if (allCompleted && !task.is_completed) {
          this.toggleTaskCompletion(task, true);
        } else if (!allCompleted && task.is_completed) {
          this.toggleTaskCompletion(task, false);
        }
        this.checkTaskCompletion(task);
        this.cdr.detectChanges();
      });
    });
  }

  deleteSubtask(task: any, subtaskId: number) {
    this.api.deleteSubtask(subtaskId).pipe(take(1)).subscribe(() => {
      this.zone.run(() => {
        task.subtasks = task.subtasks.filter((s: any) => s.id !== subtaskId);
        this.checkTaskCompletion(task);
        this.cdr.detectChanges();
      });
    });
  }

  saveSubtaskContent(subtask: any, newContent: string) {
    const content = newContent.trim();

    if (!content || content === subtask.content) {
      this.editingSubtaskId = null;
      return;
    }

    this.api.updateSubtask(subtask.id, { content: content }).pipe(take(1)).subscribe({
      next: () => {
        this.zone.run(() => {
          subtask.content = content;
          this.editingSubtaskId = null;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.editingSubtaskId = null;
      }
    });
  }

  getSubtaskProgress(task: any): number {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    const completed = task.subtasks.filter((s: any) => s.is_completed).length;
    return Math.round((completed / task.subtasks.length) * 100);
  }

  checkTaskCompletion(task: any): Observable<any> | null {
    if (!task.subtasks || task.subtasks.length === 0) return null;

    const allDone = task.subtasks.every((st: any) => st.is_completed);

    if (task.is_completed !== allDone) {
      task.is_completed = allDone;
      return this.api.updateTask(task.id, { is_completed: allDone });
    }
    return null;
  }

  COLOR_PRESETS = [
    { label: 'Red', header: '#ff0000', bg: '#fff5f5' },
    { label: 'Orange', header: '#ff8c00', bg: '#fffaf0' },
    { label: 'Amber', header: '#ffbf00', bg: '#fffbeb' },
    { label: 'Yellow', header: '#fde047', bg: '#fefce8' },
    { label: 'Citrus', header: '#bef264', bg: '#f7fee7' },
    { label: 'Lime', header: '#22c55e', bg: '#f0fdf4' },
    { label: 'Emerald', header: '#059669', bg: '#ecfdf5' },
    { label: 'Teal', header: '#0d9488', bg: '#f0fdfa' },
    { label: 'Cyan', header: '#06b6d4', bg: '#ecfeff' },
    { label: 'Azure', header: '#3b82f6', bg: '#eff6ff' },
    { label: 'Blue', header: '#1d4ed8', bg: '#eff6ff' },
    { label: 'Indigo', header: '#6366f1', bg: '#eef2ff' },
    { label: 'Violet', header: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Purple', header: '#a855f7', bg: '#faf5ff' },
    { label: 'Magenta', header: '#d946ef', bg: '#fdf4ff' }
  ];

  applyPreset(col: any, preset: any) {
    col.header_color = preset.header;
    col.bg_color = preset.bg;
  }

}