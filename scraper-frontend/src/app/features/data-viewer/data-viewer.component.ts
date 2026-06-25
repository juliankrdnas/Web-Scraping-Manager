import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ApiService, Task, ScrapedData } from '../../core/services/api.service';

@Component({
  selector: 'app-data-viewer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './data-viewer.component.html',
  styleUrls: ['./data-viewer.component.scss'],
})
export class DataViewerComponent implements OnInit {
  tasks: Task[] = [];
  selectedTaskId: string = '';
  data: ScrapedData[] = [];
  displayedColumns = ['index', 'extractedValue', 'timestamp'];

  totalRecords = 0;
  pageSize = 20;
  currentPage = 0;
  isLoading = false;
  isLoadingTasks = false;

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.isLoadingTasks = true;
    this.api.getTasks().subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.isLoadingTasks = false;

        // Preselect from query param
        this.route.queryParams.subscribe((params) => {
          if (params['taskId'] && tasks.find((t) => t._id === params['taskId'])) {
            this.selectedTaskId = params['taskId'];
            this.loadData();
          }
        });
      },
      error: () => {
        this.isLoadingTasks = false;
        this.snack.open('No se pudo cargar las tareas.', '✕', { duration: 4000, panelClass: 'snack-error' });
      },
    });
  }

  onTaskChange(): void {
    this.currentPage = 0;
    this.data = [];
    this.totalRecords = 0;
    if (this.selectedTaskId) this.loadData();
  }

  loadData(): void {
    if (!this.selectedTaskId) return;
    this.isLoading = true;
    this.api.getScrapedData(this.selectedTaskId, this.currentPage + 1, this.pageSize).subscribe({
      next: (res) => {
        this.data = res.data;
        this.totalRecords = res.total;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snack.open('Error al cargar los datos.', '✕', { duration: 4000, panelClass: 'snack-error' });
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadData();
  }

  selectedTaskName(): string {
    return this.tasks.find((t) => t._id === this.selectedTaskId)?.name ?? '';
  }

  exportData(format: 'json' | 'csv'): void {
    if (!this.selectedTaskId) return;
    this.api.exportData(this.selectedTaskId, format);
  }

  copyValue(value: string): void {
    navigator.clipboard.writeText(value);
    this.snack.open('Valor copiado.', '✕', { duration: 2000 });
  }
}