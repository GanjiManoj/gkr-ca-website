global.crypto = require('crypto');
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Validate Environment Variables on Startup
if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
  console.warn('⚠️ WARNING: ADMIN_USER or ADMIN_PASS is not defined in .env!');
}

const ADMIN_USER = (process.env.ADMIN_USER || '').trim();
const ADMIN_PASS = (process.env.ADMIN_PASS || '').trim();

// Optimized MongoDB Connection for Vercel Serverless
let isConnected = false;
async function connectDB() {
  if (isConnected || mongoose.connection.readyState >= 1) {
    isConnected = true;
    return;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
  }
}

// Middleware to ensure DB is connected before handling API requests
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    await connectDB();
  }
  next();
});

// Define Enquiry Schema & Model
const enquirySchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  message: { type: String, required: true },
  date: { 
    type: String, 
    default: () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) 
  },
  createdAt: { type: Date, default: Date.now }
});

const Enquiry = mongoose.models.Enquiry || mongoose.model('Enquiry', enquirySchema);

// Define Case Study Schema & Model
const caseStudySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

const CaseStudy = mongoose.models.CaseStudy || mongoose.model('CaseStudy', caseStudySchema);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'gkr-ca-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 }
}));

// Instantly resolve favicon requests
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Middleware to protect Admin routes
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

/* PUBLIC ROUTES */

app.get('/', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => { if (err) next(err); });
});

app.get('/case-studies', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'public', 'case-studies.html'), (err) => { if (err) next(err); });
});

app.post('/api/enquiry', async (req, res) => {
  const { name, phone, message } = req.body;
  if (!name || !phone || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const newEnquiry = new Enquiry({ name, phone, message });
    await newEnquiry.save();
    res.json({ success: true, message: 'Enquiry submitted successfully' });
  } catch (err) {
    console.error('Error saving enquiry:', err);
    res.status(500).json({ error: 'Failed to save enquiry' });
  }
});

app.get('/api/case-studies', async (req, res) => {
  try {
    const studies = await CaseStudy.find().sort({ createdAt: -1 });
    res.json(studies);
  } catch (err) {
    console.error('Error fetching case studies:', err);
    res.status(500).json({ error: 'Failed to fetch case studies' });
  }
});

/* ADMIN ROUTES */

app.get('/admin/login', (req, res, next) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.sendFile(path.join(__dirname, 'views', 'admin-login.html'), (err) => { if (err) next(err); });
});

app.post('/admin/login', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = (req.body.password || '').trim();

  if (ADMIN_USER && ADMIN_PASS && username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  
  res.status(401).json({ error: 'Invalid admin credentials' });
});

app.get('/admin/dashboard', (req, res, next) => {
  if (!req.session || !req.session.isAdmin) return res.redirect('/admin/login');
  res.sendFile(path.join(__dirname, 'views', 'admin-dashboard.html'), (err) => { if (err) next(err); });
});

app.get('/admin/add-case-study', (req, res, next) => {
  if (!req.session || !req.session.isAdmin) return res.redirect('/admin/login');
  res.sendFile(path.join(__dirname, 'views', 'add-case-study.html'), (err) => { if (err) next(err); });
});

app.post('/api/admin/case-studies', requireAdmin, async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    const newStudy = new CaseStudy({ title, description });
    await newStudy.save();
    res.json({ success: true, message: 'Case study published successfully!' });
  } catch (err) {
    console.error('Error creating case study:', err);
    res.status(500).json({ error: 'Failed to save case study' });
  }
});

app.delete('/api/admin/case-studies/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await CaseStudy.findByIdAndDelete(id);
    res.json({ success: true, message: 'Case study deleted successfully' });
  } catch (err) {
    console.error('Error deleting case study:', err);
    res.status(500).json({ error: 'Failed to delete case study' });
  }
});

app.get('/api/admin/enquiries', requireAdmin, async (req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.json(enquiries);
  } catch (err) {
    console.error('Error fetching enquiries:', err);
    res.status(500).json({ error: 'Failed to fetch enquiries' });
  }
});

app.delete('/api/admin/enquiry/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Enquiry.findByIdAndDelete(id);
    res.json({ success: true, message: 'Enquiry deleted successfully' });
  } catch (err) {
    console.error('Error deleting enquiry:', err);
    res.status(500).json({ error: 'Failed to delete enquiry' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Error destroying session:', err);
    res.redirect('/admin/login');
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start local server during local dev, export module for Vercel Serverless
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;