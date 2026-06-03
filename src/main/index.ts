import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { registerIpcHandlers } from './ipc-handlers'

const isDev = !app.isPackaged
const isMac = process.platform === 'darwin'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Site Analyzer',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    // macOS: hide the title bar but keep the traffic-light buttons (inset).
    // Other platforms: render frameless with a system overlay for min/max/close.
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    titleBarOverlay: !isMac
      ? { color: '#00000000', symbolColor: '#6b7280', height: 56 }
      : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Open in-page link clicks (e.g. the detail panel URL) in the OS browser
  // instead of navigating the app away from itself.
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url)
      const appOrigin = new URL(win.webContents.getURL()).origin
      if ((target.protocol === 'http:' || target.protocol === 'https:') && target.origin !== appOrigin) {
        event.preventDefault()
        void shell.openExternal(url)
      }
    } catch {
      /* ignore unparseable URLs */
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
