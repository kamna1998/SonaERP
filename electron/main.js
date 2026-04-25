const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');

const isDev = !app.isPackaged;
const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;

let mainWindow = null;
let backendProcess = null;

// ─── Wait for a TCP port to accept connections ───────────────────────────────

function waitForPort(port, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      if (Date.now() - start > timeout) {
        return reject(new Error(`Port ${port} did not open within ${timeout}ms`));
      }
      const socket = new net.Socket();
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        setTimeout(tryConnect, 300);
      });
      socket.connect(port, '127.0.0.1');
    }
    tryConnect();
  });
}

// ─── Spawn the Express backend ───────────────────────────────────────────────

function startBackend() {
  const serverDir = isDev
    ? path.join(__dirname, '..', 'server')
    : path.join(process.resourcesPath, 'server');

  const envPath = path.join(serverDir, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Backend .env not found at', envPath);
  }

  const tsxBin = path.join(serverDir, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  const entryPoint = path.join(serverDir, 'src', 'index.ts');

  backendProcess = spawn(tsxBin, [entryPoint], {
    cwd: serverDir,
    env: { ...process.env, NODE_ENV: 'development', PORT: String(BACKEND_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[backend:err] ${data.toString().trim()}`);
  });

  backendProcess.on('exit', (code) => {
    console.log(`[backend] exited with code ${code}`);
    backendProcess = null;
  });
}

// ─── Create the application window ──────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: 'SONA-ERP v5.0',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0a1628',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ─── Load the frontend ──────────────────────────────────────────────────────

async function loadFrontend() {
  if (isDev) {
    await mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
  } else {
    // Production: serve the built client from resources
    const indexPath = path.join(process.resourcesPath, 'client-dist', 'index.html');
    await mainWindow.loadFile(indexPath);
  }
}

// ─── IPC handlers for filesystem operations ─────────────────────────────────

ipcMain.handle('dialog:save-pdf', async (_event, { filename, buffer }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer le PDF',
    defaultPath: filename || 'document.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, Buffer.from(buffer));
  return result.filePath;
});

ipcMain.handle('dialog:save-file', async (_event, { filename, content, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer',
    defaultPath: filename || 'document.txt',
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return result.filePath;
});

ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

// ─── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  console.log('[electron] Starting SONA-ERP v5.0...');

  // 1. Start backend
  startBackend();

  // 2. Wait for backend to be ready
  console.log('[electron] Waiting for backend on port', BACKEND_PORT);
  await waitForPort(BACKEND_PORT);
  console.log('[electron] Backend is ready.');

  // 3. Create window
  createWindow();

  if (isDev) {
    // 4a. Dev: wait for Vite dev server
    console.log('[electron] Waiting for Vite dev server on port', FRONTEND_PORT);
    await waitForPort(FRONTEND_PORT);
    console.log('[electron] Vite is ready.');
  }

  // 5. Load frontend
  await loadFrontend();
  console.log('[electron] Application loaded.');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) {
    console.log('[electron] Shutting down backend...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    loadFrontend();
  }
});
