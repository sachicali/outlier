#!/usr/bin/env bun
// Development script to run both client and server with Bun

import { spawn } from 'child_process';
import { resolve } from 'path';

const rootDir = resolve(import.meta.dir, '..');

// Starting YouTube Outlier Discovery Tool in development mode

// Start server (Python)
const server = spawn('uv', ['run', 'python', 'src/index.py'], {
  cwd: resolve(rootDir, 'server-python'),
  stdio: 'inherit',
  shell: true,
});

// Start client
const client = spawn('bun', ['run', 'dev'], {
  cwd: resolve(rootDir, 'client'),
  stdio: 'inherit',
  shell: true,
});

// Handle process termination
process.on('SIGINT', () => {
  // Shutting down development servers
  server.kill();
  client.kill();
  process.exit();
});

server.on('error', (_err) => {
  // Server error occurred during startup
  process.exit(1);
});

client.on('error', (_err) => {
  // Client error occurred during startup
  process.exit(1);
});