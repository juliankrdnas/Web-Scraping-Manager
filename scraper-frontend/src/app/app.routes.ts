import { Routes } from '@angular/router';
import { TaskManagerComponent } from './features/task-manager/task-manager.component';
import { DataViewerComponent } from './features/data-viewer/data-viewer.component';

export const routes: Routes = [
  { path: '',       redirectTo: 'tasks', pathMatch: 'full' },
  { path: 'tasks',  component: TaskManagerComponent },
  { path: 'data',   component: DataViewerComponent },
  { path: '**',     redirectTo: 'tasks' },
];
