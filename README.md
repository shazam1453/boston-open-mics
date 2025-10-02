# 🎤 Boston Open Mics Platform

A comprehensive platform for managing open mic events in Boston, built with React, TypeScript, and AWS serverless architecture.

## 🌟 Features

- **User Authentication** - Secure registration and login system
- **Event Management** - Create and manage open mic events
- **Venue Management** - Add and manage performance venues
- **Signup System** - Multiple signup modes (order, random, bucket, booked)
- **Live Event Management** - Real-time performer management during events
- **Admin Panel** - Comprehensive admin tools with role-based access
- **Mobile Responsive** - Optimized for all devices
- **Social Integration** - Connect social media profiles

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API communication
- **Vite** for build tooling

### Backend
- **AWS Lambda** serverless functions
- **DynamoDB** NoSQL database
- **API Gateway** for HTTP routing
- **Node.js 18** runtime

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured
- Serverless Framework

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd boston-open-mics
   ```

2. **Install dependencies**
   ```bash
   # Frontend
   cd client
   npm install
   
   # Backend
   cd ../server
   npm install
   ```

3. **Start development servers**
   ```bash
   # Frontend (in client directory)
   npm run dev
   
   # Backend (in server directory)
   npm run dev
   ```

### Production Deployment

#### Backend (AWS)
```bash
cd server
serverless deploy --stage prod
```

#### Frontend (Netlify)
```bash
cd client
npm run build:prod
# Then deploy dist folder to Netlify
```

## 📁 Project Structure

```
boston-open-mics/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── types/         # TypeScript types
│   │   ├── utils/         # Utilities and API client
│   │   └── constants/     # Form options and constants
│   ├── public/            # Static assets
│   ├── dist/              # Production build
│   └── netlify.toml       # Netlify configuration
├── server/                # AWS Lambda backend
│   ├── lambda-dynamodb.js # Main Lambda function
│   ├── serverless.yml     # AWS deployment config
│   └── package.json       # Dependencies
└── FEATURES_GUIDE.md      # Comprehensive feature documentation
```

## 🔧 Configuration

### Environment Variables

#### Frontend (.env.production)
```
VITE_API_URL=https://your-api-gateway-url/prod/api
```

#### Backend (serverless.yml)
```yaml
environment:
  USERS_TABLE: ${self:service}-${self:provider.stage}-users
  VENUES_TABLE: ${self:service}-${self:provider.stage}-venues
  EVENTS_TABLE: ${self:service}-${self:provider.stage}-events
  SIGNUPS_TABLE: ${self:service}-${self:provider.stage}-signups
```

## 📊 Database Schema

### DynamoDB Tables

1. **Users** - User accounts and profiles
2. **Venues** - Performance venues
3. **Events** - Open mic events
4. **Signups** - Event registrations and performance data

## 🔐 Security Features

- **Password Hashing** - PBKDF2 with salt
- **JWT-like Authentication** - Secure token system
- **Role-based Access** - User, Moderator, Admin, Super Admin
- **CORS Configuration** - Proper cross-origin setup
- **Input Validation** - Server-side validation

## 🎯 User Roles

- **User** - Basic event participation
- **Moderator** - Content moderation
- **Admin** - User and event management
- **Super Admin** - Full system access

## 📱 Signup Modes

1. **Sign-up Order** - First come, first served
2. **Random Order** - Randomized performance order
3. **Bucket Style** - Host selects from bucket
4. **Booked Mic** - Invite-only professional events

## 💰 Cost Estimation

### AWS Costs (Monthly)
- **Lambda**: $1-3
- **DynamoDB**: $1-5
- **API Gateway**: $1-2
- **Total**: $3-10

### Hosting
- **Netlify**: Free tier available
- **Custom domain**: ~$10-15/year

## 🧪 Testing

### Frontend
```bash
cd client
npm run test
```

### Backend
```bash
cd server
node test-lambda.js
```

## 📚 Documentation

- [Features Guide](FEATURES_GUIDE.md) - Comprehensive feature documentation
- [Frontend Deployment](client/DEPLOYMENT.md) - Frontend deployment guide
- [Netlify Setup](client/NETLIFY-DEPLOY.md) - Netlify-specific deployment
- [Backend Setup](server/README-DYNAMODB.md) - AWS deployment guide

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the documentation in the respective directories
2. Review the troubleshooting sections
3. Open an issue on GitHub

## 🎉 Acknowledgments

Built for the Boston open mic community to help manage and organize amazing live music events!

---

**Live Demo**: [Your Netlify URL here]
**API Endpoint**: https://alaz4y94pg.execute-api.us-east-2.amazonaws.com/prod/api