const serverless = require('serverless-http');
const express = require('express');

const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Lambda is working!' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Lambda!' });
});

module.exports.handler = serverless(app);