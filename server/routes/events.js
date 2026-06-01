const express = require('express');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const { auth, optionalAuth } = require('../middleware/auth');
const pool = require('../config/database');

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

// Create group chat for event
router.post('/:id/chat/create', auth, async (req, res) => {
    try {
        const existing = await pool.query(
            "SELECT id FROM conversations WHERE event_id = $1 AND type = 'group'",
            [req.params.id]
        );
        if (existing.rows.length > 0) {
            return res.json({ conversation: existing.rows[0] });
        }

        const event = await Event.findById(req.params.id);
        const conv = await pool.query(
            "INSERT INTO conversations (type, event_id, name, created_by) VALUES ('group', $1, $2, $3) RETURNING *",
            [req.params.id, event.title, req.user.id]
        );
        await pool.query(
            'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [conv.rows[0].id, req.user.id]
        );
        res.status(201).json({ message: 'Group chat created', conversation: conv.rows[0] });
    } catch (error) {
        console.error('Create group chat error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get group chat for event
router.get('/:id/chat', auth, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM conversations WHERE event_id = $1 AND type = 'group' LIMIT 1",
            [req.params.id]
        );
        res.json({ conversation: result.rows[0] || null });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Join group chat
router.post('/:id/chat/join', auth, async (req, res) => {
    try {
        const conv = await pool.query(
            "SELECT id FROM conversations WHERE event_id = $1 AND type = 'group'",
            [req.params.id]
        );
        if (!conv.rows[0]) return res.status(404).json({ message: 'No group chat found' });

        await pool.query(
            'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [conv.rows[0].id, req.user.id]
        );
        res.json({ message: 'Joined group chat', conversation: conv.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Leave group chat
router.post('/:id/chat/leave', auth, async (req, res) => {
    try {
        const conv = await pool.query(
            "SELECT id FROM conversations WHERE event_id = $1 AND type = 'group'",
            [req.params.id]
        );
        if (!conv.rows[0]) return res.status(404).json({ message: 'No group chat found' });

        await pool.query(
            'DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
            [conv.rows[0].id, req.user.id]
        );
        res.json({ message: 'Left group chat' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete group chat
router.delete('/:id/chat/delete', auth, async (req, res) => {
    try {
        await pool.query(
            "DELETE FROM conversations WHERE event_id = $1 AND type = 'group'",
            [req.params.id]
        );
        res.json({ message: 'Group chat deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;