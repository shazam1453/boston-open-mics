const express = require('express');
const router = express.Router();
const Invitation = require('../models/Invitation');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Get user's invitations
router.get('/my-invitations', authenticateToken, async (req, res) => {
  try {
    const invitations = await Invitation.findByUser(req.user.id);
    res.json(invitations);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ message: 'Failed to fetch invitations' });
  }
});

// Get invitations for an event (host/cohost only)
router.get('/event/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // TODO: Add authorization check to ensure user is host or cohost
    const invitations = await Invitation.findByEvent(eventId);
    res.json(invitations);
  } catch (error) {
    console.error('Error fetching event invitations:', error);
    res.status(500).json({ message: 'Failed to fetch event invitations' });
  }
});

// Create invitation
router.post('/', 
  authenticateToken,
  [
    body('eventId').isInt().withMessage('Event ID must be a number'),
    body('inviteeId').isInt().withMessage('Invitee ID must be a number'),
    body('type').isIn(['cohost', 'performer']).withMessage('Type must be cohost or performer'),
    body('message').optional().isString().withMessage('Message must be a string')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { eventId, inviteeId, type, message } = req.body;
      const inviterId = req.user.id;

      // Check if invitation already exists
      const existing = await Invitation.checkExisting(eventId, inviteeId, type);
      if (existing) {
        return res.status(400).json({ 
          message: 'An invitation of this type already exists for this user and event' 
        });
      }

      // TODO: Add authorization check to ensure user can invite to this event
      // TODO: Add check to ensure invitee exists and isn't already in the role

      const invitation = await Invitation.create({
        eventId,
        inviterId,
        inviteeId,
        type,
        message
      });

      // TODO: Send email notification to invitee

      res.status(201).json(invitation);
    } catch (error) {
      console.error('Error creating invitation:', error);
      res.status(500).json({ message: 'Failed to create invitation' });
    }
  }
);

// Respond to invitation
router.patch('/:id/respond',
  authenticateToken,
  [
    body('status').isIn(['accepted', 'declined']).withMessage('Status must be accepted or declined')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      const invitation = await Invitation.updateStatus(id, status, userId);
      
      // TODO: Send email notification to inviter about response

      res.json(invitation);
    } catch (error) {
      console.error('Error responding to invitation:', error);
      if (error.message === 'Invitation not found or already responded to') {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: 'Failed to respond to invitation' });
    }
  }
);

// Delete invitation (inviter only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const invitation = await Invitation.delete(id, userId);
    
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found or unauthorized' });
    }

    res.json({ message: 'Invitation deleted successfully' });
  } catch (error) {
    console.error('Error deleting invitation:', error);
    res.status(500).json({ message: 'Failed to delete invitation' });
  }
});

module.exports = router;