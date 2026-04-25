import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://127.0.0.1:8000';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiService,
        provideHttpClient(),        // Zastępuje HttpClientModule
        provideHttpClientTesting(), // Zastępuje HttpClientTestingModule
      ]
    });

    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { 
    if (httpMock) {
      httpMock.verify();
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- TASKS ---

  it('getTasks() powinno pobrać listę zadań (GET)', () => {
    service.getTasks().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/tasks/`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('addTask() powinno wysłać żądanie POST z danymi zadania', () => {
    const mockData = { content: 'New Task', column_id: 1, swimlane_id: 1 };
    service.addTask(mockData).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/tasks/add/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(mockData);
    req.flush({});
  });

  it('updateTaskPosition() powinno wysłać żądanie PATCH z nową pozycją', () => {
    service.updateTaskPosition(10, 1, 2, 0).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/tasks/10/move/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ column_id: 1, swimlane_id: 2, position: 0 });
    req.flush({});
  });

  it('deleteTask() powinno wysłać żądanie DELETE', () => {
    service.deleteTask(10).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/tasks/10/delete/`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('updateTask() powinno wysłać żądanie PATCH z aktualizacją danych', () => {
    const updateData = { content: 'Updated Content' };
    service.updateTask(10, updateData).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/tasks/10/update/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(updateData);
    req.flush({});
  });

  // --- COLUMNS ---

  it('addColumn() powinno wysłać żądanie POST', () => {
    const colData = { title: 'New Col', limit: 5 };
    service.addColumn(colData).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/columns/add/`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('deleteColumn() powinno wysłać żądanie DELETE', () => {
    service.deleteColumn(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/columns/1/delete/`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('updateColumn() powinno wysłać żądanie PATCH', () => {
    service.updateColumn(1, { title: 'New Title' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/columns/1/update/`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('updateColumnOrder() powinno wysłać żądanie POST z nową kolejnością', () => {
    const order = [{ id: 1, position: 0 }];
    service.updateColumnOrder(order).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/columns/reorder/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(order);
    req.flush({});
  });

  // --- SWIMLANES / USERS ---

  it('addSwimlane() powinno wysłać żądanie POST', () => {
    service.addSwimlane({ name: 'New Swimlane' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/swimlanes/add/`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('deleteSwimlane() powinno wysłać żądanie DELETE', () => {
    service.deleteSwimlane(2).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/swimlanes/2/delete/`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('updateSwimlane() powinno wysłać żądanie PATCH', () => {
    service.updateSwimlane(2, { name: 'Updated' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/swimlanes/2/update/`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('toggleTaskUser() powinno wysłać żądanie POST z user_id', () => {
    service.toggleTaskUser(10, 5).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/tasks/10/toggle-user/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ user_id: 5 });
    req.flush({});
  });

  it('addUser() powinno wysłać żądanie POST', () => {
    service.addUser({ username: 'testuser' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/users/add/`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('deleteUser() powinno wysłać żądanie DELETE', () => {
    service.deleteUser(5).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/users/5/delete/`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('updateUser() powinno wysłać żądanie PATCH', () => {
    service.updateUser(5, { color: '#ff0000' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/users/5/update/`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  // --- SUBTASKS ---

  it('addSubtask() powinno wysłać żądanie POST', () => {
    service.addSubtask(10, 'Subtask content').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/tasks/10/subtasks/add/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ content: 'Subtask content' });
    req.flush({});
  });

  it('updateSubtask() powinno wysłać żądanie PATCH', () => {
    service.updateSubtask(1, { is_completed: true }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/subtasks/1/update/`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('deleteSubtask() powinno wysłać żądanie DELETE', () => {
    service.deleteSubtask(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/subtasks/1/delete/`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });



});