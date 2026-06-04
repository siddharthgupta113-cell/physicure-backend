const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, email, mobile, password, city, product_code, product_name } = req.body;

    if (!first_name || !email || !mobile || !password) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }
      return res.status(400).json({ success: false, message: authError.message });
    }

    const userId = authData.user.id;

    // Save profile details
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        first_name: first_name.trim(),
        last_name: last_name?.trim() || '',
        mobile: mobile.trim(),
        city: city || ''
      });

    if (profileError) console.error('Profile error:', profileError);

    // Register product if provided
    if (product_name) {
      const code = product_code ? product_code.toUpperCase() : `PC-AUTO-${Date.now()}`;
      await supabase.from('user_products').insert({
        user_id: userId,
        product_code: code,
        product_name
      });

      // Award Activator badge
      const { data: badge } = await supabase
        .from('badges')
        .select('id')
        .eq('condition_type', 'product_registered')
        .single();

      if (badge) {
        await supabase.from('user_badges').insert({ user_id: userId, badge_id: badge.id });
      }
    }

    // Sign in to get token
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });

    if (signInError) {
      return res.status(201).json({ success: true, message: `Welcome to PhysiCure, ${first_name}! Please log in.` });
    }

    res.status(201).json({
      success: true,
      message: `Welcome to PhysiCure, ${first_name}! Your product is activated 🎉`,
      token: signInData.session.access_token,
      user: {
        id: userId,
        first_name,
        last_name,
        email: email.toLowerCase(),
        mobile,
        city
      }
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Please enter your login details' });
    }

    // Try email login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier.toLowerCase(),
      password
    });

    if (error) {
      // Try mobile lookup
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('mobile', identifier)
        .single();

      if (!profileData) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Get email from auth
      const { data: userData } = await supabase.auth.admin.getUserById(profileData.user_id);
      if (!userData) return res.status(401).json({ success: false, message: 'Account not found' });

      const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password
      });

      if (retryError) return res.status(401).json({ success: false, message: 'Incorrect password' });

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', retryData.user.id)
        .single();

      return res.json({
        success: true,
        message: `Welcome back, ${profile?.first_name || 'there'}!`,
        token: retryData.session.access_token,
        user: { id: retryData.user.id, ...profile }
      });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single();

    res.json({
      success: true,
      message: `Welcome back, ${profile?.first_name || 'there'}!`,
      token: data.session.access_token,
      user: { id: data.user.id, email: data.user.email, ...profile }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// POST /api/auth/request-otp
router.post('/request-otp', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ success: false, message: 'Mobile number required' });
  // In production: integrate MSG91 here
  const otp = Math.floor(100000 + Math.random() * 900000);
  console.log(`[DEV OTP for ${mobile}]: ${otp}`);
  res.json({ success: true, message: `OTP sent to ${mobile}`, dev_otp: otp });
});

module.exports = router;
