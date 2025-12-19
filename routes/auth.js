const express = require('express');
const jwt = require('jsonwebtoken');
const { createOrUpdateUser } = require('../utils/db');

const router = express.Router();

// Get AUTH_URL and THIS_URL from environment
const AUTH_URL = process.env.AUTH_URL || 'https://formbar.yorktechapps.com';
const THIS_URL = process.env.THIS_URL || `http://localhost:${process.env.PORT || 3000}/login`;

/**
 * Middleware to check if user is authenticated
 */
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        const tokenData = req.session.token;

        try {
            // Check if the token has expired
            const currentTime = Math.floor(Date.now() / 1000);
            if (tokenData.exp < currentTime) {
                throw new Error('Token has expired');
            }

            next();
        } catch (err) {
            // Token expired, try to refresh
            res.redirect(`${AUTH_URL}/oauth?refreshToken=${tokenData.refreshToken}&redirectURL=${THIS_URL}`);
        }
    } else {
        res.redirect(`/login?redirectURL=${THIS_URL}`);
    }
}

/**
 * Login route - handles OAuth callback or redirects to Formbar
 */
router.get('/login', async (req, res) => {
    if (req.query.token) {
        try {
            // Decode the JWT token from Formbar
            let tokenData = jwt.decode(req.query.token);
            
            if (!tokenData) {
                return res.redirect(`${AUTH_URL}/oauth?redirectURL=${THIS_URL}`);
            }

            // Store token and user info in session
            req.session.token = tokenData;
            req.session.user = tokenData.displayName;
            req.session.userId = tokenData.userId || tokenData.id;

            // Create or update user in database
            await createOrUpdateUser(
                tokenData.userId || tokenData.id,
                tokenData.displayName
            );

            // Redirect to home page
            res.redirect('/');
        } catch (error) {
            console.error('Login error:', error);
            res.redirect(`${AUTH_URL}/oauth?redirectURL=${THIS_URL}`);
        }
    } else {
        // No token, redirect to Formbar OAuth
        res.redirect(`${AUTH_URL}/oauth?redirectURL=${THIS_URL}`);
    }
});

/**
 * Logout route
 */
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/login');
    });
});

module.exports = { router, isAuthenticated };

