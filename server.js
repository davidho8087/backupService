const express = require('express');
const cors = require('cors');
const logger = require('./lib/logger.js');
const morgan = require('morgan');

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ credentials: false }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.get('/', (req, res) => {
  res.send('This is AI app service');
});

// Updated error handling middleware
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({ message: `An error occurred: ${err.message}` });
});

module.exports = app;
