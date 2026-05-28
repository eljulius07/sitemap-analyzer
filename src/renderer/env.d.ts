/// <reference types="vite/client" />
import type { SitemapApi } from '../preload'

declare global {
  interface Window {
    api: SitemapApi
  }
}

export {}
