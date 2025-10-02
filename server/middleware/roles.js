// Role-based access control middleware

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

const requireVenueOwner = requireRole(['venue_owner', 'admin']);
const requireAdmin = requireRole(['admin']);

module.exports = {
  requireRole,
  requireVenueOwner,
  requireAdmin
};