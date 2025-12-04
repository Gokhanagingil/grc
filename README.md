# GRC Platform

A comprehensive Governance, Risk, and Compliance (GRC) platform built with Node.js, Express.js, React, and TypeScript.

## 🚀 Features

### Backend (Node.js + Express.js)
- **Authentication**: JWT-based authentication system
- **Database**: SQLite3 with comprehensive schema
- **API**: RESTful API endpoints for all GRC operations
- **Security**: Helmet, CORS, Morgan logging
- **Routes**: Auth, Users, Governance, Risk, Compliance, Dashboard

### Frontend (React + TypeScript)
- **UI Framework**: Material-UI (MUI)
- **State Management**: React Context API
- **Routing**: React Router DOM
- **Charts**: Recharts for data visualization
- **Date Handling**: date-fns library

### Database Schema
- **Users**: User management with roles
- **Policies**: Policy lifecycle management
- **Risks**: Risk assessment and management
- **Compliance**: Regulatory compliance tracking
- **Audit Logs**: Comprehensive audit trail
- **Organizations**: Organizational structure
- **Risk Assessments**: Risk evaluation records

## 📁 Project Structure

```
grc-platform/
├── backend/
│   ├── database/
│   │   ├── connection.js
│   │   └── grc.db
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── governance.js
│   │   ├── risk.js
│   │   ├── compliance.js
│   │   └── dashboard.js
│   ├── server.js
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Governance.tsx
│   │   │   ├── RiskManagement.tsx
│   │   │   ├── Compliance.tsx
│   │   │   └── UserManagement.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   └── App.tsx
│   └── package.json
└── README.md
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Git

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Governance
- `GET /api/governance/policies` - Get all policies
- `POST /api/governance/policies` - Create policy
- `PUT /api/governance/policies/:id` - Update policy
- `DELETE /api/governance/policies/:id` - Delete policy

### Risk Management
- `GET /api/risk` - Get all risks
- `POST /api/risk` - Create risk
- `PUT /api/risk/:id` - Update risk
- `DELETE /api/risk/:id` - Delete risk

### Compliance
- `GET /api/compliance` - Get all compliance requirements
- `POST /api/compliance` - Create compliance requirement
- `PUT /api/compliance/:id` - Update compliance requirement
- `DELETE /api/compliance/:id` - Delete compliance requirement

### Dashboard
- `GET /api/dashboard/overview` - Get dashboard overview
- `GET /api/dashboard/activities` - Get recent activities
- `GET /api/dashboard/risk-trends` - Get risk trends
- `GET /api/dashboard/compliance-by-regulation` - Get compliance by regulation

## 🔧 Environment Variables

### Backend (.env)
```
NODE_ENV=development
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
DB_PATH=./database/grc.db
```

### Frontend
```
REACT_APP_API_URL=http://localhost:3001/api
```

## 🚀 Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

### Frontend Development
```bash
cd frontend
npm start  # Starts React development server
```

## 📊 Database Schema

The platform uses SQLite3 with the following main tables:
- `users` - User management
- `policies` - Policy management
- `risks` - Risk management
- `compliance_requirements` - Compliance tracking
- `audit_logs` - Audit trail
- `organizations` - Organizational structure
- `risk_assessments` - Risk evaluations

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- CORS protection
- Helmet security headers
- Input validation
- SQL injection protection
- Audit logging

## 📈 Future Enhancements

- [ ] File upload functionality
- [ ] Email notifications
- [ ] Advanced reporting
- [ ] Workflow management
- [ ] Multi-tenant support
- [ ] API documentation
- [ ] Unit tests
- [ ] Integration tests
- [ ] Docker containerization
- [ ] CI/CD pipeline

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👥 Authors

- GRC Platform Development Team

## 📞 Support

For support and questions, please contact the development team.

---
*Last verified: December 2024*
