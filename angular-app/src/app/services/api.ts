import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://127.0.0.1:8000';

  constructor(private http: HttpClient) {}

  // --- TASKI ---
  getTasks(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/tasks/`);
  }

  addTask(data: { content: string, column_id: number }): Observable<any> {
    return this.http.post(`${this.baseUrl}/tasks/add/`, data);
  }

  updateTaskPosition(taskId: number, newColumnId: string, order: number): Observable<any> {
    return this.http.patch(`${this.baseUrl}/tasks/${taskId}/move/`, {
      column_id: newColumnId,
      order: order
    });
  }

  deleteTask(taskId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/tasks/${taskId}/delete/`);
  }

  updateTask(taskId: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/tasks/${taskId}/update/`, data);
  }

  // --- KOLUMNY ---

  addColumn(data: { title: string }): Observable<any> {
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
}