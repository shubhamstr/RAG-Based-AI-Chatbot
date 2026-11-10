import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './src/config';
import routes from './src/routes';

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from the 'public' directory
app.use(express.static(config.publicDir));

// Serve uploaded PDF documents for preview
app.use('/uploads', express.static(config.uploadDir));

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Mount application routes
app.use(routes);

// 404 Handler for unknown routes
app.use((req: Request, res: Response) => {
  const isApi = req.path.startsWith('/api') || req.xhr || req.headers.accept?.includes('application/json');

  if (isApi) {
    return res.status(404).json({
      success: false,
      error: `Route not found: ${req.method} ${req.originalUrl}`
    });
  }

  return res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - Not Found</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #0f172a; color: #f8fafc; }
        .container { text-align: center; padding: 2rem; }
        h1 { font-size: 5rem; margin: 0; color: #38bdf8; font-weight: 800; }
        p { font-size: 1.25rem; color: #94a3b8; margin: 1rem 0 2rem; }
        a { display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; transition: background 0.2s; }
        a:hover { background-color: #0369a1; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404</h1>
        <p>The page you requested could not be found.</p>
        <a href="/">Go to Home</a>
      </div>
    </body>
    </html>
  `);
});

// Centralized error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled application error:', err);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = (err as any).status || 500;
  const message = err.message || 'Internal Server Error';
  const isApi = req.path.startsWith('/api') || req.xhr || req.headers.accept?.includes('application/json');

  if (isApi) {
    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }

  return res.status(statusCode).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${statusCode} - Server Error</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #0f172a; color: #f8fafc; }
        .container { text-align: center; padding: 2rem; }
        h1 { font-size: 5rem; margin: 0; color: #f43f5e; font-weight: 800; }
        p { font-size: 1.25rem; color: #94a3b8; margin: 1rem 0 2rem; }
        a { display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${statusCode}</h1>
        <p>${message}</p>
        <a href="/">Return Home</a>
      </div>
    </body>
    </html>
  `);
});

// Start server
app.listen(config.port, () => {
  console.log(`Server is running at http://localhost:${config.port}`);
});

export default app;
