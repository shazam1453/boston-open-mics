const express = require('express');
const { body, validationResult } = require('express-validator');
const Venue = require('../models/Venue');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all venues
router.get('/', optionalAuth, async (req, res) => {
  try {
    const venues = await Venue.findAll();
    res.json(venues);
  } catch (error) {
    console.error('Get venues error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get venue by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    res.json(venue);
  } catch (error) {
    console.error('Get venue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create venue (authenticated users only)
router.post('/', auth, [
  body('name').trim().isLength({ min: 1 }),
  body('address').trim().isLength({ min: 1 }),
  body('phone').optional().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('description').optional().trim(),
  body('capacity').optional().isInt({ min: 1 }),
  body('amenities').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, address, phone, email, description, capacity, amenities } = req.body;

    const venue = await Venue.create({
      name,
      address,
      phone,
      email,
      description,
      capacity,
      amenities: amenities || [],
      ownerId: req.user.id
    });

    res.status(201).json({
      message: 'Venue created successfully',
      venue
    });
  } catch (error) {
    console.error('Create venue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update venue (owner only)
router.put('/:id', auth, [
  body('name').optional().trim().isLength({ min: 1 }),
  body('address').optional().trim().isLength({ min: 1 }),
  body('phone').optional().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('description').optional().trim(),
  body('capacity').optional().isInt({ min: 1 }),
  body('amenities').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    if (venue.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this venue' });
    }

    const updates = {};
    const allowedFields = ['name', 'address', 'phone', 'email', 'description', 'capacity', 'amenities'];
    
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key) && req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });

    const updatedVenue = await Venue.update(req.params.id, updates);
    
    res.json({
      message: 'Venue updated successfully',
      venue: updatedVenue
    });
  } catch (error) {
    console.error('Update venue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete venue (owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    if (venue.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this venue' });
    }

    await Venue.delete(req.params.id);
    
    res.json({ message: 'Venue deleted successfully' });
  } catch (error) {
    console.error('Delete venue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get venues by owner
router.get('/owner/:ownerId', optionalAuth, async (req, res) => {
  try {
    const venues = await Venue.findByOwner(req.params.ownerId);
    res.json(venues);
  } catch (error) {
    console.error('Get venues by owner error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;