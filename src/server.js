import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import { connectDB } from './config/db.js';
import User from './models/User.js';
import Service from './models/Service.js';
import authRoutes from './routes/auth.js';
import servicesRoutes from './routes/services.js';
import { protect } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const allowedOrigins = [
  'http://localhost:5173',
  'https://fullomyself.github.io',
  'https://fullomyself.github.io/multiservice_frontend'
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

const seedUsers = [
  {
    name: 'Platform Admin',
    email: 'admin@multiservice.local',
    role: 'admin',
    passwordEnv: 'SEED_ADMIN_PASSWORD'
  },
  {
    name: 'Sarah Plumber',
    email: 'provider@multiservice.local',
    role: 'provider',
    passwordEnv: 'SEED_PROVIDER_PASSWORD'
  },
  {
    name: 'Customer Example',
    email: 'customer@multiservice.local',
    role: 'customer',
    passwordEnv: 'SEED_CUSTOMER_PASSWORD'
  }
];

const seedServices = [
  {
    name: 'Home Cleaning',
    category: 'Home Services',
    description: 'Routine home cleaning for homes and apartments.',
    price: 450,
    durationMinutes: 120
  },
  {
    name: 'AC Repair',
    category: 'Repairs',
    description: 'Fast inspection and repair for residential air conditioning units.',
    price: 850,
    durationMinutes: 180
  },
  {
    name: 'Digital Marketing Setup',
    category: 'Business',
    description: 'Setup and optimization for online brand presence and local campaigns.',
    price: 1200,
    durationMinutes: 240
  }
];

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'multiserviceplatform-backend'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);

app.get('/api/dashboard', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const services = await Service.find({ status: 'active' }).limit(20);

    return res.json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role
        },
        services: services.map((service) => ({
          id: service._id.toString(),
          name: service.name,
          category: service.category,
          description: service.description,
          price: service.price,
          durationMinutes: service.durationMinutes,
          providerName: service.providerName
        })),
        totalServices: await Service.countDocuments({ status: 'active' }),
        totalUsers: await User.countDocuments({ isActive: true })
      }
    });
  } catch (error) {
    console.error('Dashboard failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load dashboard.' });
  }
});

app.use(errorHandler);

async function seedInitialData() {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    return;
  }

  const missingSeeds = seedUsers
    .map((seed) => ({ ...seed, value: process.env[seed.passwordEnv] }))
    .filter((seed) => !seed.value);

  if (missingSeeds.length > 0) {
    const missingList = missingSeeds.map((seed) => seed.passwordEnv).join(', ');
    console.warn(`Seed users skipped: set ${missingList} in your .env file.`);
    return;
  }

  const createdUsers = await Promise.all(
    seedUsers.map(async (seed) => {
      const password = await bcrypt.hash(process.env[seed.passwordEnv], 10);
      return User.create({
        name: seed.name,
        email: seed.email,
        password,
        role: seed.role
      });
    })
  );

  const provider = createdUsers.find((user) => user.role === 'provider');
  if (!provider) {
    console.warn('No provider seed user was created.');
    return;
  }

  await Service.create(
    seedServices.map((service) => ({
      ...service,
      provider: provider._id,
      providerName: provider.name,
      status: 'active'
    }))
  );

  console.log('Seeded default admin, provider, customer and service data.');
  return createdUsers;
}

function startServer() {
  connectDB()
    .then(async (dbConnected) => {
      if (dbConnected) {
        await seedInitialData();
      }

      const server = app.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${PORT} is already in use. Stop the other process or change PORT in the environment.`);
          process.exit(1);
        }

        console.error('Server failed to start:', error);
        process.exit(1);
      });
    })
    .catch((error) => {
      console.error('Database connection failed:', error);
      process.exit(1);
    });
}

startServer();
