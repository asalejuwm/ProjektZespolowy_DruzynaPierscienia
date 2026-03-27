import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://127.0.0.1:8000';

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

  addColumn(data: { title: string, limit: number }): Observable<any> {
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
}