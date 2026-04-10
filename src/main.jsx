// TEMPORARY BROWSER MOCK: Remove this once you run the app inside your desktop wrapper
window.storage = {
  get: async (key) => {
    const val = localStorage.getItem(key);
    return val ? { value: val } : null;
  },
  set: async (key, val) => {
    localStorage.setItem(key, val);
  }
};

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import BudgetTracker from './BudgetTracker.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BudgetTracker />
  </StrictMode>,
)
