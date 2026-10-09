// ============================================================
// CampusSOS v2 — Hash Router
// Simple hash-based SPA routing
// ============================================================

const routes = {};
let currentCleanup = null;

/** Register a route handler */
export function route(path, handler) {
  routes[path] = handler;
}

/** Navigate to a route */
export function navigate(path) {
  window.location.hash = path;
}

/** Get current route path */
export function currentRoute() {
  return window.location.hash.slice(1) || '/student';
}

/** Get route param from path (e.g. /student/ticket/CMP-123 -> CMP-123) */
export function getParam(pattern, hash) {
  // pattern: /student/ticket/:id
  // hash:    /student/ticket/CMP-123
  const patternParts = pattern.split('/');
  const hashParts = hash.split('/');
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = hashParts[i];
    }
  }
  return params;
}

import { isAuthenticated, getAuthUser, getUserRole } from './state.js';
import { showToast } from './utils.js';

/** Initialize router */
export function initRouter() {
  const handleRoute = () => {
    let hash = currentRoute();
    const content = document.getElementById('page-content');
    const authed = isAuthenticated();
    const role = getUserRole();

    // 1. Auth Guard: if not authenticated, redirect all protected pages to /login
    if (!authed && hash !== '/login') {
      navigate('/login');
      return;
    }

    // 2. If authenticated and trying to visit /login, redirect to their home portal
    if (authed && hash === '/login') {
      navigate(`/${role || 'student'}`);
      return;
    }

    // 3. Role-Based Access Control Guard
    if (authed) {
      if (role === 'student' && (hash.startsWith('/faculty') || hash.startsWith('/admin'))) {
        showToast('Access Denied: Students cannot access staff or administrator dashboards.', 'error');
        navigate('/student');
        return;
      }
      if (role === 'faculty' && hash.startsWith('/admin')) {
        showToast('Access Denied: Staff accounts do not have administrator permissions.', 'error');
        navigate('/faculty');
        return;
      }
    }

    // Clean up previous page
    if (currentCleanup && typeof currentCleanup === 'function') {
      currentCleanup();
      currentCleanup = null;
    }

    // Find matching route (longest match first)
    let matched = false;
    const sortedRoutes = Object.keys(routes).sort((a, b) => b.length - a.length);

    for (const pattern of sortedRoutes) {
      if (matchRoute(pattern, hash)) {
        const params = extractParams(pattern, hash);
        const result = routes[pattern](content, params);
        // If handler returns a cleanup function, save it
        if (typeof result === 'function') {
          currentCleanup = result;
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Default fallback
      if (authed) {
        navigate(`/${role || 'student'}`);
      } else {
        navigate('/login');
      }
    }
  };

  window.addEventListener('hashchange', handleRoute);

  // Initial route check
  if (!window.location.hash) {
    if (isAuthenticated()) {
      window.location.hash = `/${getUserRole() || 'student'}`;
    } else {
      window.location.hash = '/login';
    }
  } else {
    handleRoute();
  }
}

/** Check if pattern matches hash */
function matchRoute(pattern, hash) {
  const patternParts = pattern.split('/');
  const hashParts = hash.split('/');

  if (patternParts.length !== hashParts.length) return false;

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) continue;
    if (patternParts[i] !== hashParts[i]) return false;
  }
  return true;
}

/** Extract params from matching route */
function extractParams(pattern, hash) {
  const patternParts = pattern.split('/');
  const hashParts = hash.split('/');
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(hashParts[i]);
    }
  }
  return params;
}
