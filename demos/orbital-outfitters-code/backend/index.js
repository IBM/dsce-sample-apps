import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import ordersRoutes from './routes/orders.js';
import agentSearchRoutes from './routes/agentSearch.js';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const app = express();
const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
const swaggerDoc = YAML.load(new URL('./docs/swagger.yaml', import.meta.url).pathname);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/products', productsRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', ordersRoutes);
app.use('/agentSearch', agentSearchRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.BACKEND_PORT || 3001);
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
