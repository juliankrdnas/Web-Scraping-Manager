import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Task {
  _id?: string;
  name: string;
  targetUrl: string;
  cssSelector: string;
  cronSchedule: string;
  isActive: boolean;
  lastRun?: string;
  lastStatus?: 'success' | 'error' | 'pending' | 'never';
  createdAt?: string;
  updatedAt?: string;
}

export interface ScrapedData {
  _id: string;
  taskId: string;
  extractedValue: string;
  timestamp: string;
}

export interface PaginatedData {
  data: ScrapedData[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  // ── Tareas ─────────────────────────────────────────────────
  createTask(task: Partial<Task>): Observable<Task> {
    return this.http.post<Task>(`${this.baseUrl}/tasks`, task);
  }

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/tasks`);
  }

  getTask(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.baseUrl}/tasks/${id}`);
  }

  updateTask(id: string, task: Partial<Task>): Observable<Task> {
    return this.http.put<Task>(`${this.baseUrl}/tasks/${id}`, task);
  }

  deleteTask(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/tasks/${id}`);
  }

  runTask(id: string): Observable<{ status: string; value: string }> {
    return this.http.post<{ status: string; value: string }>(
      `${this.baseUrl}/tasks/${id}/run`,
      {}
    );
  }

  // ── Datos ───────────────────────────────────────────────────
  getScrapedData(taskId: string, page = 1, limit = 50): Observable<PaginatedData> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<PaginatedData>(`${this.baseUrl}/data/${taskId}`, { params });
  }
}
