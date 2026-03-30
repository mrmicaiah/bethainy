import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from './middleware/auth';
import { chatRoutes } from './routes/chat';
import { dataRoutes } from './routes/data';
import { userRoutes } from './routes/users';

export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  CLAUDE_MODEL: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS for frontend
app.use('/*', cors({
  origin: ['http://localhost:3000', 'https://bethainy.pages.dev'],
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({ status: 'ok', app: 'bethainy' }));

// Public routes
app.route('/users', userRoutes);

// Protected routes
app.use('/chat/*', auth);
app.use('/data/*', auth);
app.route('/chat', chatRoutes);
app.route('/data', dataRoutes);

export default app;
