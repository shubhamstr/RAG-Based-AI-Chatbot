import express from 'express';
import cors from 'cors';
import { config } from './src/config';
import routes from './src/routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(config.publicDir));
app.use('/uploads', express.static(config.uploadDir));

// Routes
app.use(routes);

// Start server
app.listen(config.port, () => {
  console.log(`Server is running at http://localhost:${config.port}`);
});

export default app;
