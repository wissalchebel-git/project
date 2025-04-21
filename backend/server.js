require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const getKeycloak = require('./keycloak/keycloak-config');
const errorHandler = require('./middleware/errorHandler');
const reportRoutes = require('./routes/reporttRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const gitRoutes = require('./routes/gitRoutes');

const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');

// Connect to the database
connectDB();

// Create Express app
const app = express();

// Session store
const memoryStore = new session.MemoryStore();
app.use(session({
  secret: process.env.SESSION_SECRET || 'some secret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

// Body parsers
app.use(express.json());
app.use(bodyParser.json());

// CORS
app.use(cors());

// Keycloak setup (uncomment when ready)
// const keycloak = getKeycloak({ store: memoryStore });
// app.use(keycloak.middleware());

// Routes (use Keycloak protection when ready)
// app.use('/api/security-reports', keycloak.protect(), reportRoutes);
// app.use('/api/auth', authRoutes); // public route
// app.use('/api/users', keycloak.protect(), userRoutes);


// Define the root route for testing
app.get('/', (req, res) => {
  res.send('Hello, your server is running!');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/git', gitRoutes);

// Error handling middleware
app.use(errorHandler);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
