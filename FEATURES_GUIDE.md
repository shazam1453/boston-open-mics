# Boston Open Mics Platform - Features Guide

## Overview
A comprehensive platform for managing open mic events in Boston, connecting performers with venues and providing tools for event organization and performer management.

## User Authentication & Profiles

### Registration & Login
- **Sign Up**: Create account with email, password, and social media links
- **Social Media Integration**: Add Instagram, Twitter, TikTok, YouTube, and website links
- **Profile Management**: Edit personal information and social media profiles anytime
- **Secure Authentication**: JWT-based authentication with persistent sessions

### User Roles
- **Performers**: Sign up for events, manage performance history
- **Hosts**: Create and manage venues and events
- **Co-hosts**: Collaborate on event management with full access

## Venue Management

### Creating Venues
1. Navigate to Profile → "My Venues" tab
2. Click "Create New Venue"
3. Fill in venue details:
   - Name and description
   - Address and contact information
   - Capacity and amenities

### Managing Venues
- Edit venue information
- View all events at your venues
- Delete venues (if no active events)

## Event Management

### Event Types
- **One-time Events**: Single occurrence events
- **Recurring Events**: Weekly repeating events with templates

### Creating Events
1. Go to Profile → "My Events" tab
2. Choose "Create One-time Event" or "Create Recurring Event"
3. Configure event details:
   - Basic info (name, description, date/time)
   - Signup window (when sign-ups open/close)
   - Performance settings (slot duration, performer limits)
   - Signup list mode selection

### Sign-up List Modes

#### 1. Sign-up Order
- Performers perform in the order they signed up
- First come, first served basis
- Predictable performance order

#### 2. Random Order
- Performance order randomized at event time
- Fair chance for all performers regardless of sign-up time
- Order revealed when event starts

#### 3. Bucket Style
- Host manually selects performers during the event
- Most flexible for host management
- Allows for curated performance flow

### Event Settings
- **Sign-up Window**: Control when sign-ups open and close
- **Time Format**: 12-hour format with AM/PM
- **Performer Limits**: Set maximum number of performers
- **Slot Duration**: Define performance time slots

## Co-host System

### Adding Co-hosts
1. Open your event details
2. Go to "Co-hosts" section
3. Search for users by name or email
4. Send co-host invitations

### Co-host Permissions
- Full event management access
- Can modify event settings
- Manage performer sign-ups
- Access live event controls

## Event Discovery Event Discovery & Signup Sign-up

### Finding Events
- **All Events**: Browse all upcoming events
- **Filter Options**: Search by date, venue, or event type
- **Event Details**: View full event information before signing up

### Signing Up for Events
1. Find an event during its sign-up window
2. Click "Sign Up" button
3. Confirm your performance slot
4. Receive confirmation and event details

### Managing Your Sign-ups
- View in Profile → "My Performances" tab
- Cancel sign-ups (within allowed timeframe)
- Track upcoming performances

## Live Event Management

### For Hosts (During Events)

#### Sign-up Order & Random Order Events
- View performer list in order
- Mark performers as "performed"
- Track event progress

#### Bucket Style Events
- **Available Performers**: See all signed-up performers
- **Select Next**: Choose who performs next
- **Performed List**: Track completed performances
- **Flexible Management**: Change order as needed

### Real-time Updates
- Live performer status updates
- Automatic list management
- Mobile-optimized controls

## Mobile Experience

### Responsive Design
- Touch-friendly interface
- Optimized for mobile devices
- Easy navigation on small screens

### Mobile Features
- Swipe-friendly event browsing
- Large touch targets for buttons
- Simplified mobile navigation
- Quick access to key features

## Dashboard Navigation

### Profile Tabs
1. **Profile Info**: Edit personal details and social media
2. **My Venues**: Manage your venues
3. **My Events**: View and manage hosted events
4. **My Performances**: Track your signups and performance history

### Events Page Tabs
1. **All Events**: Browse all available events
2. **Hosting**: Events you're hosting or co-hosting
3. **My Performances**: Events you've signed up for

## Time Management

### Custom Time Picker
- 12-hour format (AM/PM)
- Preset time options for quick selection
- Manual time entry capability
- Intuitive hour/minute/period selection

## Data & Privacy

### Data Storage
- Secure user information storage
- Event and sign-up history tracking
- Social media link management

### Privacy Features
- Control over profile visibility
- Secure authentication
- Optional social media sharing

## Getting Started

### For Performers
1. Create account with social media links
2. Browse events in "All Events"
3. Sign up for events during sign-up windows
4. Track performances in "My Performances"

### For Venue Owners/Hosts
1. Create account and complete profile
2. Add your venue in "My Venues"
3. Create events for your venue
4. Manage signups and run live events
5. Add co-hosts for collaborative management

### For Co-hosts
1. Accept co-host invitation
2. Access shared event management
3. Help manage sign-ups and live events
4. Collaborate with main host

## Technical Features

### Backend Capabilities
- RESTful API with comprehensive endpoints
- PostgreSQL database with proper relationships
- JWT authentication and authorization
- Role-based access control
- File-based data persistence for testing

### Frontend Features
- React with TypeScript
- Mobile-responsive design
- Real-time state management
- Custom UI components
- Tailwind CSS styling

## Support & Troubleshooting

### Common Tasks
- **Reset Password**: Contact administrator
- **Cancel Sign-up**: Use "My Performances" tab
- **Edit Event**: Access through "My Events"
- **Add Co-host**: Use event management interface
- **Update Profile**: Use "Profile Info" tab

### Best Practices
- Sign up early for popular events
- Keep profile information current
- Set appropriate sign-up windows
- Use co-hosts for large events
- Test bucket mode before live events

---

*This platform is designed to make open mic management simple and accessible for both performers and hosts in the Boston area.*