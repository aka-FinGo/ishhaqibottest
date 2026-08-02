// ============================================================
// src/main.js — Single Modular Entry Point (No Root Script Tags)
// ============================================================

// 1. Core Modules
import * as Config from './core/config.js';
import { AppState } from './core/state.js';
import { apiRequest } from './core/api.js';
import { AppCache } from './core/cache.js';

// 2. Component Utils
import * as UiUtils from './components/ui_utils.js';

// 3. Stylesheets
import './styles/style.css';
import './styles/components.css';
import './styles/dark.css';
import './styles/ai_chat.css';
import './styles/gloss.css';
import './styles/module_fl.css';

// 4. Feature Modules
import './modules/admin/roles.js';
import './modules/admin/employee.js';
import './modules/admin/admin.js';
import './modules/admin/admin_workflow.js';
import './modules/admin/admin_positions.js';
import './modules/admin/admin_notifications.js';
import './modules/admin/enhanced_admin_list.js';

import './modules/kvadratlar/kvadratlar.js';
import './modules/kvadratlar/dashboard_kv.js';

import './modules/report/dashboard.js';
import './modules/report/dashboard_charts.js';
import './modules/report/export.js';
import './modules/report/actions.js';
import './modules/report/detail_modal.js';

import './modules/ai_chat/admin_ai.js';
import './modules/ai_chat/admin_ai_chat.js';

import './modules/module_fl/module_fl.js';

// Expose Config & Core globals for HTML onclick compatibility
Object.assign(window, Config);
Object.assign(window, UiUtils);
window.AppState = AppState;
window.apiRequest = apiRequest;
window.AppCache = AppCache;

console.log(`🚀 Aristokrat Ish Haqi Fully Modular System Bootstrapped (${Config.APP_VERSION})`);
