import { initializeConfig } from '@config/index.js';

// Initialize config before running unit tests
// This ensures all modules that depend on config at import time have access to it
await initializeConfig();
