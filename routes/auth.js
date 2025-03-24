const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const sendEmail = require('../config/mailer');
const fs = require('fs');
require('dotenv').config();

const router = express.Router();

// SIGNUP - Sends verification email
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.json({ status: 'error', message: 'All fields are required' });

    // Check if user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, result) => {
        if (result.length > 0) {
            return res.json({ status: 'error', message: 'Email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const code = Math.floor(100000 + Math.random() * 900000); // 6-digit code

        // Save user
        db.query('INSERT INTO users (name, email, password, verification_code, verified) VALUES (?, ?, ?, ?, 0)', 
            [name, email, hashedPassword, code]);

        // Send verification email
        let emailTemplate = fs.readFileSync('./templates/verify_email.html', 'utf8');
        emailTemplate = emailTemplate.replace('{{name}}', name).replace('{{code}}', code);
        sendEmail(email, 'Verify Your Email', emailTemplate);

        res.json({ status: 'success', message: 'Verification email sent' });
    });
});

// EMAIL VERIFICATION
router.post('/verify', (req, res) => {
    const { email, code } = req.body;
    db.query('SELECT verification_code FROM users WHERE email = ?', [email], (err, result) => {
        if (result.length === 0 || result[0].verification_code !== code) {
            return res.json({ status: 'error', message: 'Invalid code' });
        }

        db.query('UPDATE users SET verified = 1 WHERE email = ?', [email]);
        res.json({ status: 'success', message: 'Email verified' });
    });
});

// PASSWORD RESET REQUEST
router.post('/reset-request', (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000);
    db.query('UPDATE users SET reset_code = ? WHERE email = ?', [code, email]);

    let emailTemplate = fs.readFileSync('./templates/reset_password.html', 'utf8');
    emailTemplate = emailTemplate.replace('{{code}}', code);
    sendEmail(email, 'Reset Password', emailTemplate);

    res.json({ status: 'success', message: 'Reset email sent' });
});

// PASSWORD RESET
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    db.query('UPDATE users SET password = ? WHERE email = ? AND reset_code = ?', [hashedPassword, email, code]);
    res.json({ status: 'success', message: 'Password updated' });
});

module.exports = router;
