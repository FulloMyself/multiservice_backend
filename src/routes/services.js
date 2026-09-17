import express from 'express';
import Service from '../models/Service.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const services = await Service.find({ status: 'active' }).populate('provider', 'name email role');
    return res.json({
      success: true,
      data: services.map((service) => ({
        id: service._id.toString(),
        name: service.name,
        category: service.category,
        description: service.description,
        price: service.price,
        durationMinutes: service.durationMinutes,
        status: service.status,
        providerId: service.provider?._id?.toString?.() || service.provider,
        providerName: service.providerName
      }))
    });
  } catch (error) {
    console.error('Fetch services failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load services.' });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { name, category, description, price, durationMinutes } = req.body;

    if (!name || !category || !price) {
      return res.status(400).json({
        success: false,
        message: 'Name, category and price are required.'
      });
    }

    const actor = await User.findById(req.user.id);
    if (!actor || (actor.role !== 'provider' && actor.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only providers and admins can create services.'
      });
    }

    const newService = await Service.create({
      name: String(name).trim(),
      category: String(category).trim(),
      description: String(description || '').trim(),
      price: Number(price),
      durationMinutes: Number(durationMinutes || 60),
      provider: actor._id,
      providerName: actor.name,
      status: 'active'
    });

    return res.status(201).json({
      success: true,
      message: 'Service created.',
      data: {
        id: newService._id.toString(),
        name: newService.name,
        category: newService.category,
        description: newService.description,
        price: newService.price,
        durationMinutes: newService.durationMinutes,
        providerId: actor._id.toString(),
        providerName: actor.name,
        status: newService.status
      }
    });
  } catch (error) {
    console.error('Create service failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to create service.' });
  }
});

export default router;
