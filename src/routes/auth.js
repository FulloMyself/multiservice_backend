import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

function normalizePhoneNumber(value) {
  if (!value) return '';
  const cleaned = String(value).trim();
  return cleaned.replace(/\s+/g, ' ').replace(/\s*[-()/]+\s*/g, ' ').trim();
}

function isValidSouthAfricanPhone(value) {
  const normalised = normalizePhoneNumber(value || '');
  if (!normalised) return true;

  const digitsOnly = normalised.replace(/\D/g, '');
  if (/^0\d{9}$/.test(digitsOnly) || /^27\d{9}$/.test(digitsOnly)) {
    return true;
  }

  return /^\+27\d{9}$/.test(normalised.replace(/\s+/g, ''));
}

function isValidSouthAfricanId(value) {
  if (!value) return true;
  const normalised = String(value).replace(/\s+/g, '').trim();
  return /^\d{13}$/.test(normalised);
}

function toPublicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    idNumber: user.idNumber || '',
    address: user.address || '',
    city: user.city || '',
    province: user.province || '',
    country: user.country || 'South Africa',
    isActive: user.isActive
  };
}

function issueToken(user) {
  const secret = process.env.JWT_SECRET || 'development-secret';
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name
    },
    secret,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'customer' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role
    });

    const token = issueToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        user: toPublicUser(newUser),
        token
      }
    });
  } catch (error) {
    console.error('Register failed:', error);
    return res.status(500).json({ success: false, message: 'Registration failed.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = issueToken(user);

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: toPublicUser(user),
        token
      }
    });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ success: false, message: 'Login failed.' });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({
      success: true,
      data: toPublicUser(user)
    });
  } catch (error) {
    console.error('Fetch user failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load user profile.' });
  }
});

router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const {
      name,
      email,
      phone,
      idNumber,
      address,
      city,
      province,
      country,
      currentPassword,
      newPassword
    } = req.body;

    if (currentPassword || newPassword) {
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current and new passwords are required to change your password.'
        });
      }

      const passwordMatches = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatches) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
      }

      if (String(newPassword).length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    if (name !== undefined) user.name = String(name).trim() || user.name;
    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ success: false, message: 'Email is required.' });
      }

      const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'This email is already in use.' });
      }

      user.email = normalizedEmail;
    }

    if (phone !== undefined) {
      const cleanedPhone = normalizePhoneNumber(phone);
      if (cleanedPhone && !isValidSouthAfricanPhone(cleanedPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Phone number must be a valid South African mobile number.'
        });
      }
      user.phone = cleanedPhone;
    }

    if (idNumber !== undefined) {
      const cleanedId = String(idNumber).replace(/\s+/g, '').trim();
      if (cleanedId && !isValidSouthAfricanId(cleanedId)) {
        return res.status(400).json({
          success: false,
          message: 'Identity number must be a valid 13-digit South African ID number.'
        });
      }
      user.idNumber = cleanedId;
    }

    if (address !== undefined) user.address = String(address).trim();
    if (city !== undefined) user.city = String(city).trim();
    if (province !== undefined) user.province = String(province).trim();
    if (country !== undefined) user.country = String(country).trim() || 'South Africa';

    await user.save();

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: toPublicUser(user)
    });
  } catch (error) {
    console.error('Update profile failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to update profile.' });
  }
});

export default router;
