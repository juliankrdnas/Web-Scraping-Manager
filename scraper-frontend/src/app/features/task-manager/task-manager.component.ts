import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { RouterModule } from '@angular/router';

import { ApiService, Task } from '../../core/services/api.service';

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './task-manager.component.html',
  styleUrls: ['./task-manager.component.scss'],
})
export class TaskManagerComponent implements OnInit {
  taskForm!: FormGroup;
  tasks: Task[] = [];
  isLoading = false;
  isSaving = false;
  editingTaskId: string | null = null;

  cronExamples = [
    { label: 'Cada minuto', value: '* * * * *' },
    { label: 'Cada hora', value: '0 * * * *' },
    { label: 'Cada 6 h', value: '0 */6 * * *' },
    { label: 'Diario a medianoche', value: '0 0 * * *' },
  ];

  constructor(private fb: FormBuilder, private api: ApiService, private snack: MatSnackBar) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadTasks();
  }

  buildForm(): void {
    this.taskForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      targetUrl: ['', [Validators.required, Validators.pattern('https?://.+')]],
      cssSelector: ['', Validators.required],
      cronSchedule: ['0 * * * *', Validators.required],
      isActive: [true],
    });
  }

  loadTasks(): void {
    this.isLoading = true;
    this.api.getTasks().subscribe({
      next: (tasks) => { this.tasks = tasks; this.isLoading = false; },
      error: () => { this.showError('No se pudo conectar con el backend.'); this.isLoading = false; },
    });
  }

  applyCronExample(value: string): void {
    this.taskForm.patchValue({ cronSchedule: value });
  }

  onSubmit(): void {
    if (this.taskForm.invalid) return;
    this.isSaving = true;

    const op$ = this.editingTaskId
      ? this.api.updateTask(this.editingTaskId, this.taskForm.value)
      : this.api.createTask(this.taskForm.value);

    op$.subscribe({
      next: () => {
        this.showSuccess(this.editingTaskId ? 'Tarea actualizada.' : 'Tarea creada.');
        this.resetForm();
        this.loadTasks();
        this.isSaving = false;
      },
      error: (err) => {
        this.showError(err?.error?.error || 'Error al guardar la tarea.');
        this.isSaving = false;
      },
    });
  }

  editTask(task: Task): void {
    this.editingTaskId = task._id!;
    this.taskForm.patchValue(task);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteTask(task: Task): void {
    if (!confirm(`¿Eliminar la tarea "${task.name}" y todos sus datos?`)) return;
    this.api.deleteTask(task._id!).subscribe({
      next: () => { this.showSuccess('Tarea eliminada.'); this.loadTasks(); },
      error: () => this.showError('No se pudo eliminar la tarea.'),
    });
  }

  runNow(task: Task): void {
    task.lastStatus = 'pending';
    this.api.runTask(task._id!).subscribe({
      next: (res) => {
        task.lastStatus = res.status;
        const preview = res.values?.length
          ? `${res.values.length} dato(s) capturado(s): ${res.values[0].substring(0, 50)}...`
          : 'El scraping no devolvió datos.';
        this.showSuccess(res.status === 'success' ? preview : 'El scraping no devolvió datos.');
        this.loadTasks();
      },
      error: () => this.showError('Error al ejecutar la tarea.'),
    });
  }

  toggleActive(task: Task): void {
    this.api.updateTask(task._id!, { isActive: !task.isActive }).subscribe({
      next: () => this.loadTasks(),
      error: () => this.showError('No se pudo cambiar el estado.'),
    });
  }

  resetForm(): void {
    this.editingTaskId = null;
    this.taskForm.reset({ cronSchedule: '0 * * * *', isActive: true });
  }

  statusColor(status?: string): string {
    const map: Record<string, string> = { success: 'status-success', error: 'status-error', pending: 'status-pending', never: 'status-never' };
    return map[status ?? 'never'] ?? 'status-never';
  }

  statusIcon(status?: string): string {
    const map: Record<string, string> = { success: 'check_circle', error: 'error', pending: 'hourglass_empty', never: 'radio_button_unchecked' };
    return map[status ?? 'never'] ?? 'radio_button_unchecked';
  }

  private showSuccess(msg: string): void {
    this.snack.open(msg, '✕', { duration: 4000, panelClass: 'snack-success' });
  }
  private showError(msg: string): void {
    this.snack.open(msg, '✕', { duration: 5000, panelClass: 'snack-error' });
  }
}
