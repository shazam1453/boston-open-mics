const express = require('express');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all events with optional filters
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { date, eventType, venueId } = req.query;
        const filters = {};

        if (date) filters.date = date;
        if (eventType) filters.eventType = eventType;
        if (venueId) filters.venueId = parseInt(venueId);

        const events = await Event.findAll(filters);
        res.json(events);
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get event by ID
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json(event);
    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create event (authenticated users only)
router.post('/', auth, [
    body('title').trim().isLength({ min: 1 }),
    body('description').optional().trim(),
    body('venueId').isInt({ min: 1 }),
    body('date').isISO8601().toDate(),
    body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('maxPerformers').isInt({ min: 1 }),
    body('performanceLength').isInt({ min: 1 }),
    body('eventType').isIn(['open-mic', 'showcase', 'competition', 'workshop']),
    body('signupOpens').optional().isISO8601().toDate(),
    body('signupDeadline').optional().isISO8601().toDate()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            title,
            description,
            venueId,
            date,
            startTime,
            endTime,
            maxPerformers,
            performanceLength,
            eventType,
            signupOpens,
            signupDeadline
        } = req.body;

        const event = await Event.create({
            title,
            description,
            venueId,
            date,
            startTime,
            endTime,
            maxPerformers,
            performanceLength,
            eventType,
            signupOpens,
            signupDeadline,
            hostId: req.user.id
        });

        res.status(201).json({
            message: 'Event created successfully',
            event
        });
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update event (host only)
router.put('/:id', auth, [
    body('title').optional().trim().isLength({ min: 1 }),
    body('description').optional().trim(),
    body('venueId').optional().isInt({ min: 1 }),
    body('date').optional().isISO8601().toDate(),
    body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('endTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('maxPerformers').optional().isInt({ min: 1 }),
    body('performanceLength').optional().isInt({ min: 1 }),
    body('eventType').optional().isIn(['open-mic', 'showcase', 'competition', 'workshop']),
    body('signupOpens').optional().isISO8601().toDate(),
    body('signupDeadline').optional().isISO8601().toDate()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (event.host_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to update this event' });
        }

        const updates = {};
        const allowedFields = [
            'title', 'description', 'venue_id', 'date', 'start_time', 'end_time',
            'max_performers', 'performance_length', 'event_type', 'signup_opens', 'signup_deadline'
        ];

        Object.keys(req.body).forEach(key => {
            const dbKey = key === 'venueId' ? 'venue_id' :
                key === 'startTime' ? 'start_time' :
                    key === 'endTime' ? 'end_time' :
                        key === 'maxPerformers' ? 'max_performers' :
                            key === 'performanceLength' ? 'performance_length' :
                                key === 'eventType' ? 'event_type' :
                                    key === 'signupOpens' ? 'signup_opens' :
                                        key === 'signupDeadline' ? 'signup_deadline' : key;

            if (allowedFields.includes(dbKey) && req.body[key] !== undefined) {
                updates[dbKey] = req.body[key];
            }
        });

        const updatedEvent = await Event.update(req.params.id, updates);

        res.json({
            message: 'Event updated successfully',
            event: updatedEvent
        });
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete event (host only)
router.delete('/:id', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (event.host_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this event' });
        }

        await Event.delete(req.params.id);

        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get events by host
router.get('/host/:hostId', optionalAuth, async (req, res) => {
    try {
        const events = await Event.findByHost(req.params.hostId);
        res.json(events);
    } catch (error) {
        console.error('Get events by host error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;