import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // --- TASKS ---
  
  // Zmieniamy typ na Observable<any>, bo teraz wraca obiekt z 3 listami, a nie tylko tablica zadań
  getTasks(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/tasks/`);
  }

  // Dodajemy swimlane_id do parametrów
  addTask(data: { content: string, column_id: number, swimlane_id: number }): Observable<any> {
    return this.http.post(`${this.baseUrl}/tasks/add/`, data);
  }

  // Teraz przesyłamy komplet informacji: gdzie (kolumna), u kogo (swimlane) i na której pozycji
  updateTaskPosition(taskId: number, columnId: number, swimlaneId: number, position: number): Observable<any> {
    return this.http.patch(`${this.baseUrl}/tasks/${taskId}/move/`, {
      column_id: columnId,
      swimlane_id: swimlaneId,
      position: position
    });
  }

  deleteTask(taskId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/tasks/${taskId}/delete/`);
  }

  updateTask(taskId: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/tasks/${taskId}/update/`, data);
  }

  // --- COLUMNS ---

  addColumn(data: { title: string, limit: number,header_color?: string, bg_color?: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/columns/add/`, data);
  }

  deleteColumn(columnId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/columns/${columnId}/delete/`);
  }

  updateColumn(columnId: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/columns/${columnId}/update/`, data);
  }

  updateColumnOrder(orderData: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/columns/reorder/`, orderData);
  }

  // opcjonalnie: jeśli będziesz chciał dodawać osoby z poziomu frontendu
  addSwimlane(data: { name: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/swimlanes/add/`, data);
  }

  deleteSwimlane(swimlaneId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/swimlanes/${swimlaneId}/delete/`);
  }

  updateSwimlane(swimId: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/swimlanes/${swimId}/update/`, data);
  }

  toggleTaskUser(taskId: number, userId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/tasks/${taskId}/toggle-user/`, { user_id: userId });
  }

  addUser(data: { username: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/add/`, data);
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/users/${userId}/delete/`);
  }

  updateUser(userId: number, data: { task_limit?: number, color?: string }): Observable<any> {
    return this.http.patch(`${this.baseUrl}/users/${userId}/update/`, data);
  }
  addSubtask(taskId: number, content: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/tasks/${taskId}/subtasks/add/`, { content });
  }

  updateSubtask(subtaskId: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/subtasks/${subtaskId}/update/`, data);
  }

  deleteSubtask(subtaskId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/subtasks/${subtaskId}/delete/`);
  }
}