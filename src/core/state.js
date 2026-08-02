// ============================================================
// src/core/state.js — Centralized Reactive Application State
// ============================================================

class StateManager {
  constructor() {
    this.state = {
      globalAdminData: [],
      globalAdminDataIsPartial: false,
      filteredData: [],
      myFullRecords: [],
      myFilteredRecords: [],
      currentPage: 1,
      myRole: 'User',
      myUsername: '',
      myCanAdd: true,
      myInList: false,
      myIsSardor: false,
      canViewCompanyActions: false,
      canExportCompanyData: false,
      adminContactId: '',
      myPermissions: {
        canViewAll: false,
        canEdit: false,
        canDelete: false,
        canExport: false,
        canViewDash: false
      },
      globalEmployeeList: [],
      _kvEmpMap: {}
    };

    this.listeners = new Set();
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
    this.notify();
  }

  update(newState) {
    Object.assign(this.state, newState);
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.state));
  }
}

export const AppState = new StateManager();

// Also expose safely on window for backwards compatibility during migration
window.AppState = AppState;
