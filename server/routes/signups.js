const express = require('express');
const { body, validationResult } = require('express-validator');
const Signup = require('../models/Signup');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Create signup (authenticated users only)
router.post('/', auth, [
  body('eventId').isInt({ min: 1 }),
  body('performanceName').trim().isLength({ min: 1 }),
  body('notes').optional().trim(),
  body('performanceType').isIn(['music', 'comedy', 'poetry', 'storytelling', 'other'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { eventId, performanceName, notes, performanceType } = req.body;

    const signup = await Signup.create({
      eventId,
      userId: req.user.id,
      performanceName,
      notes,
      performanceType
    });

    res.status(201).json({
      message: 'Signup created successfully',
      signup
    });
  } catch (error) {
    if (error.message === 'User already signed up for this event') {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === 'Event is full') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Create signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get signups for an event
router.get('/event/:eventId', auth, async (req, res) => {
  try {
    const signups = await Signup.findByEvent(req.params.eventId);
    res.json(signups);
  } catch (error) {
    console.error('Get event signups error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get signups for current user
router.get('/my-signups', auth, async (req, res) => {
  try {
    const signups = await Signup.findByUser(req.user.id);
    res.json(signups);
  } catch (error) {
    console.error('Get user signups error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get signups for a specific user
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const signups = await Signup.findByUser(req.params.userId);
    res.json(signups);
  } catch (error) {
    console.error('Get user signups error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update signup status (event host only)
router.put('/:id/status', auth, [
  body('status').isIn(['confirmed', 'waitlist', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // TODO: Add authorization check to ensure user is the event host
    const { status } = req.body;
    
    const updatedSignup = await Signup.updateStatus(req.params.id, status);
    
    if (!updatedSignup) {
      return res.status(404).json({ message: 'Signup not found' });
    }

    res.json({
      message: 'Signup status updated successfully',
      signup: updatedSignup
    });
  } catch (error) {
    console.error('Update signup status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel signup (user can cancel their own signup)
router.delete('/event/:eventId', auth, async (req, res) => {
  try {
    const deletedSignup = await Signup.deleteByEventAndUser(req.params.eventId, req.user.id);
    
    if (!deletedSignup) {
      return res.status(404).json({ message: 'Signup not found' });
    }

    res.json({ message: 'Signup cancelled successfully' });
  } catch (error) {
    console.error('Cancel signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete signup by ID (admin or user who created it)
router.delete('/:id', auth, async (req, res) => {
  try {
    // TODO: Add authorization check
    const deletedSignup = await Signup.delete(req.params.id);
    
    if (!deletedSignup) {
      return res.status(404).json({ message: 'Signup not found' });
    }

    res.json({ message: 'Signup deleted successfully' });
  } catch (error) {
    console.error('Delete signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update performer order (event host only)
router.put('/event/:eventId/order', auth, [
  body('signupIds').isArray().withMessage('signupIds must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { signupIds } = req.body;
    
    // TODO: Add authorization check to ensure user is the event host
    const updatedSignups = await Signup.updatePerformerOrder(req.params.eventId, signupIds);

    res.json({
      message: 'Performer order updated successfully',
      signups: updatedSignups
    });
  } catch (error) {
    console.error('Update performer order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark performer as finished (event host only)
router.put('/:id/finish', auth, async (req, res) => {
  try {
    // TODO: Add authorization check to ensure user is the event host
    const updatedSignup = await Signup.markAsFinished(req.params.id);
    
    if (!updatedSignup) {
      return res.status(404).json({ message: 'Signup not found' });
    }

    res.json({
      message: 'Performer marked as finished',
      signup: updatedSignup
    });
  } catch (error) {
    console.error('Mark performer finished error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unmark performer as finished (event host only)
router.put('/:id/unfinish', auth, async (req, res) => {
  try {
    // TODO: Add authorization check to ensure user is the event host
    const updatedSignup = await Signup.unmarkAsFinished(req.params.id);
    
    if (!updatedSignup) {
      return res.status(404).json({ message: 'Signup not found' });
    }

    res.json({
      message: 'Performer unmarked as finished',
      signup: updatedSignup
    });
  } catch (error) {
    console.error('Unmark performer finished error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add performer manually (event host only)
router.post('/event/:eventId/add-performer', auth, [
  body('performanceName').trim().isLength({ min: 1 }),
  body('performerName').trim().isLength({ min: 1 }),
  body('performanceType').isIn(['music', 'comedy', 'poetry', 'storytelling', 'other']),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { performanceName, performerName, performanceType, notes } = req.body;

    // TODO: Add authorization check to ensure user is the event host
    const signup = await Signup.addManualPerformer({
      eventId: req.params.eventId,
      performanceName,
      performerName,
      performanceType,
      notes
    });

    res.status(201).json({
      message: 'Performer added successfully',
      signup
    });
  } catch (error) {
    console.error('Add manual performer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;