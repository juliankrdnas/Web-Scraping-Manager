import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Task {
  _id?: string;
  name: string;
  targetUrl: string;
  cssSelector: string;
  cronSchedule: string;
  isActive: boolean;
  lastRun?: string;
  lastStatus?: 'success' | 'error' | 'pending' | 'never';
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // Paginación dinámica
  isPaginated?: boolean;
  paginationStart?: number;
  paginationStep?: number;
  maxPages?: number;
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
  private baseUrl = environment.apiUrl;

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

  deleteTask(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/tasks/${id}`);
  }

  runTask(id: string): Observable<{ status: 'success' | 'error'; values: string[] }> {
    return this.http.post<{ status: 'success' | 'error'; values: string[] }>(
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

  exportData(taskId: string, format: 'json' | 'csv'): void {
    const url = `${this.baseUrl}/data/${taskId}/export?format=${format}`;
    // Abrir en nueva pestaña dispara la descarga directamente desde el backend
    window.open(url, '_blank');
  }
}
