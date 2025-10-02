const express = require('express');
const { body, validationResult } = require('express-validator');
const RecurringEventTemplate = require('../models/RecurringEventTemplate');
const Event = require('../models/Event');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get recurring templates for a venue
router.get('/venue/:venueId', auth, async (req, res) => {
  try {
    const templates = await RecurringEventTemplate.findByVenue(req.params.venueId);
    res.json(templates);
  } catch (error) {
    console.error('Get recurring templates error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create recurring event template
router.post('/', auth, [
  body('venueId').isInt({ min: 1 }),
  body('title').trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('maxPerformers').isInt({ min: 1 }),
  body('performanceLength').isInt({ min: 1 }),
  body('eventType').isIn(['open-mic', 'showcase', 'competition', 'workshop']),
  body('dayOfWeek').isInt({ min: 0, max: 6 }),
  body('signupOpensHoursBefore').optional().isInt({ min: 1 }),
  body('signupDeadlineHoursBefore').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      venueId,
      title,
      description,
      startTime,
      endTime,
      maxPerformers,
      performanceLength,
      eventType,
      dayOfWeek,
      signupOpensTime,
      signupDeadlineTime,
      signupOpensHoursBefore,
      signupDeadlineHoursBefore
    } = req.body;

    // Check if user owns the venue
    const Venue = require('../models/Venue');
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    if (venue.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only create recurring events for venues you own' });
    }

    const template = await RecurringEventTemplate.create({
      venueId,
      title,
      description,
      startTime,
      endTime,
      maxPerformers,
      performanceLength,
      eventType,
      dayOfWeek,
      signupOpensTime: signupOpensTime || null,
      signupDeadlineTime: signupDeadlineTime || null,
      signupOpensHoursBefore: signupOpensHoursBefore || 168, // Default 1 week
      signupDeadlineHoursBefore: signupDeadlineHoursBefore || 2, // Default 2 hours
      createdBy: req.user.id
    });

    res.status(201).json({
      message: 'Recurring event template created successfully',
      template
    });
  } catch (error) {
    console.error('Create recurring template error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate events from template
router.post('/:id/generate', auth, [
  body('numberOfEvents').optional().isInt({ min: 1, max: 12 })
], async (req, res) => {
  try {
    const templateId = req.params.id;
    const numberOfEvents = req.body.numberOfEvents || 4;

    const eventDataArray = await RecurringEventTemplate.generateEvents(templateId, numberOfEvents);
    
    // Create the events in the database
    const createdEvents = [];
    for (const eventData of eventDataArray) {
      const event = await Event.create(eventData);
      createdEvents.push(event);
    }

    res.json({
      message: `Generated ${createdEvents.length} events successfully`,
      events: createdEvents
    });
  } catch (error) {
    console.error('Generate events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update recurring template
router.put('/:id', auth, [
  body('title').optional().trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('endTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('maxPerformers').optional().isInt({ min: 1 }),
  body('performanceLength').optional().isInt({ min: 1 }),
  body('signupOpensHoursBefore').optional().isInt({ min: 1 }),
  body('signupDeadlineHoursBefore').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const template = await RecurringEventTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Check if user created this template
    if (template.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this template' });
    }

    const updates = {};
    const allowedFields = [
      'title', 'description', 'start_time', 'end_time', 'max_performers',
      'performance_length', 'signup_opens_hours_before', 'signup_deadline_hours_before'
    ];
    
    Object.keys(req.body).forEach(key => {
      const dbKey = key === 'startTime' ? 'start_time' :
                   key === 'endTime' ? 'end_time' :
                   key === 'maxPerformers' ? 'max_performers' :
                   key === 'performanceLength' ? 'performance_length' :
                   key === 'signupOpensHoursBefore' ? 'signup_opens_hours_before' :
                   key === 'signupDeadlineHoursBefore' ? 'signup_deadline_hours_before' : key;
      
      if (allowedFields.includes(dbKey) && req.body[key] !== undefined) {
        updates[dbKey] = req.body[key];
      }
    });

    const updatedTemplate = await RecurringEventTemplate.update(req.params.id, updates);
    
    res.json({
      message: 'Template updated successfully',
      template: updatedTemplate
    });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Deactivate recurring template
router.delete('/:id', auth, async (req, res) => {
  try {
    const template = await RecurringEventTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Check if user created this template
    if (template.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this template' });
    }

    await RecurringEventTemplate.deactivate(req.params.id);
    
    res.json({ message: 'Template deactivated successfully' });
  } catch (error) {
    console.error('Deactivate template error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;