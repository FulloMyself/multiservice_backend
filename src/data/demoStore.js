import bcrypt from 'bcryptjs';

export const demoStore = {
  users: [],
  services: [],
  bookings: []
};

export function seedDemoData() {
  if (demoStore.users.length > 0) return;

  const adminPassword = bcrypt.hashSync('admin123', 10);
  const providerPassword = bcrypt.hashSync('provider123', 10);

  demoStore.users.push(
    {
      id: 'u-admin-1',
      name: 'Platform Admin',
      email: 'admin@multiservice.local',
      password: adminPassword,
      role: 'admin',
      createdAt: new Date().toISOString()
    },
    {
      id: 'u-provider-1',
      name: 'Sarah Plumber',
      email: 'provider@multiservice.local',
      password: providerPassword,
      role: 'provider',
      createdAt: new Date().toISOString()
    },
    {
      id: 'u-customer-1',
      name: 'Customer Example',
      email: 'customer@multiservice.local',
      password: bcrypt.hashSync('customer123', 10),
      role: 'customer',
      createdAt: new Date().toISOString()
    }
  );

  demoStore.services.push(
    {
      id: 's-1',
      name: 'Home Cleaning',
      category: 'Home Services',
      description: 'Routine home cleaning for homes and apartments.',
      price: 450,
      durationMinutes: 120,
      providerId: 'u-provider-1',
      providerName: 'Sarah Plumber',
      status: 'active'
    },
    {
      id: 's-2',
      name: 'AC Repair',
      category: 'Repairs',
      description: 'Fast inspection and repair for residential air conditioning units.',
      price: 850,
      durationMinutes: 180,
      providerId: 'u-provider-1',
      providerName: 'Sarah Plumber',
      status: 'active'
    },
    {
      id: 's-3',
      name: 'Digital Marketing Setup',
      category: 'Business',
      description: 'Setup and optimization for online brand presence and local campaigns.',
      price: 1200,
      durationMinutes: 240,
      providerId: 'u-provider-1',
      providerName: 'Sarah Plumber',
      status: 'active'
    }
  );
}
