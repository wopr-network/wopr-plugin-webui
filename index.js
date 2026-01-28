/**
 * WOPR Web UI Plugin
 *
 * Serves the React-based web dashboard for WOPR.
 * Built with SolidJS, TailwindCSS, and Vite.
 */

import http from "http";
import { createReadStream, existsSync } from "fs";
import { extname, join } from "path";

let ctx = null;
let server = null;

// Content types for static files
const CONTENT_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

// Start HTTP server to serve built web UI
function startServer(port = 3000, host = "127.0.0.1") {
  const distDir = join(ctx.getPluginDir(), "dist");
  
  const server = http.createServer((req, res) => {
    // Security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    
    // CORS for development
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    // Determine file path
    let urlPath = req.url === "/" ? "/index.html" : req.url;
    // Handle client-side routing - serve index.html for non-file paths
    if (!extname(urlPath)) {
      urlPath = "/index.html";
    }
    
    const filePath = join(distDir, urlPath);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(distDir)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }
    
    // Check if file exists
    if (!existsSync(filePath)) {
      // Serve index.html for client-side routing
      const indexPath = join(distDir, "index.html");
      if (existsSync(indexPath)) {
        res.setHeader("Content-Type", "text/html");
        createReadStream(indexPath).pipe(res);
        return;
      }
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    
    // Serve file
    const ext = extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    
    createReadStream(filePath).pipe(res);
  });
  
  server.listen(port, host, () => {
    ctx.log.info(`Web UI server running at http://${host}:${port}`);
  });
  
  return server;
}

export default {
  name: "webui",
  version: "0.1.0",
  description: "Web UI dashboard for WOPR",

  async init(pluginContext) {
    ctx = pluginContext;
    const config = ctx.getConfig();
    
    const port = config.port || 3000;
    const host = config.host || "127.0.0.1";
    
    // Check if dist folder exists
    const distDir = join(ctx.getPluginDir(), "dist");
    if (!existsSync(distDir)) {
      ctx.log.error("dist/ folder not found. Run 'npm run build' first.");
      ctx.log.info("The Web UI needs to be built before it can be served.");
      return;
    }
    
    // Start server
    server = startServer(port, host);
    
    // Register as the main web UI
    if (ctx.registerWebUiExtension) {
      ctx.registerWebUiExtension({
        id: "main",
        title: "Web Dashboard",
        url: `http://${host}:${port}`,
        description: "WOPR web interface",
        category: "core",
      });
      ctx.log.info("Registered Web UI extension");
    }
    
    ctx.log.info(`Web UI available at http://${host}:${port}`);
    ctx.log.info(`Make sure the WOPR daemon API is accessible from the browser`);
  },

  async shutdown() {
    if (server) {
      ctx?.log.info("Web UI server shutting down...");
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      server = null;
    }
  },
};
