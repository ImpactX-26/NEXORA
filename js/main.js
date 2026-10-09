// ============================================================
// CampusSOS v2 — Main Application Entry Point
// ============================================================

import { route, initRouter } from './router.js';
import { renderTopbar } from './topbar.js';
import { renderLoginPage } from './pages/login.js?v=2.3';
import { renderStudentPortal } from './pages/student.js?v=2.3';
import { renderFacultyPortal } from './pages/faculty.js?v=2.3';
import { renderAdminDashboard } from './pages/admin.js?v=2.3';
import { renderTicketDetail } from './pages/ticketDetail.js?v=2.3';
import { startBackgroundSync } from './engine.js?v=2.3';
import { loadPrefs, setCurrentRole } from './state.js?v=2.3';
import { startLiveSlaTicker } from './utils.js?v=2.3';

document.addEventListener('DOMContentLoaded', () => {
  // Load saved preferences and auth session
  loadPrefs();

  // Initialize top navigation
  renderTopbar();

  // Start live 1-second real-time SLA countdown ticker
  startLiveSlaTicker();

  // Register SPA Routes
  route('/login', (container) => {
    return renderLoginPage(container);
  });

  route('/student', (container) => {
    setCurrentRole('student');
    return renderStudentPortal(container);
  });

  route('/faculty', (container) => {
    setCurrentRole('faculty');
    return renderFacultyPortal(container);
  });

  route('/admin', (container) => {
    setCurrentRole('admin');
    return renderAdminDashboard(container);
  });

  route('/ticket/:id', (container, params) => {
    return renderTicketDetail(container, params);
  });

  route('/student/ticket/:id', (container, params) => {
    setCurrentRole('student');
    return renderTicketDetail(container, params);
  });

  route('/faculty/ticket/:id', (container, params) => {
    setCurrentRole('faculty');
    return renderTicketDetail(container, params);
  });

  // Start hash router
  initRouter();

  // Start background auto-sync loop with Flask backend (every 2.5 seconds)
  startBackgroundSync(2500);

  console.log('[CampusSOS v2] Frontend initialized and connected to Flask backend.');
});
