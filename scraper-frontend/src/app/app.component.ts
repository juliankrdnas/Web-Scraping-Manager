import { Component } from '@angular/core';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    <header class="app-toolbar">
      <div class="toolbar-brand">
        <mat-icon class="brand-icon">hub</mat-icon>
        <span class="brand-name">WebScraper <span class="brand-accent">Orquestador</span></span>
      </div>

      <nav class="toolbar-nav">
        <a mat-button routerLink="/tasks" routerLinkActive="nav-active" id="nav-tasks">
          <mat-icon>task_alt</mat-icon> Tareas
        </a>
        <a mat-button routerLink="/data" routerLinkActive="nav-active" id="nav-data">
          <mat-icon>bar_chart</mat-icon> Datos
        </a>
      </nav>
    </header>

    <main class="app-main">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; }

    .app-toolbar {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 2rem; height: 64px;
      background: var(--surface-glass);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
    }

    .toolbar-brand {
      display: flex; align-items: center; gap: 10px; text-decoration: none;
      .brand-icon { color: var(--accent); font-size: 28px; width: 28px; height: 28px; }
      .brand-name { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.3px; }
      .brand-accent { color: var(--accent); }
    }

    .toolbar-nav {
      display: flex; gap: 0.25rem;
      a { border-radius: 10px !important; display: flex; align-items: center; gap: 6px;
          color: var(--text-muted); transition: color 0.2s, background 0.2s; }
      a:hover { color: var(--text-primary); background: rgba(255,255,255,0.06); }
    }

    .app-main { flex: 1; padding: 2rem; max-width: 1200px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  `],
})
export class AppComponent { }
