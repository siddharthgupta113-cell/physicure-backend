const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const supabase = require('../supabase');

// GET /api/users/me
router.get('/me', auth, async (req, res) => {
  try {
    const uid = req.user.id;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', uid)
      .single();

    const { data: gamification } = await supabase
      .from('gamification')
      .select('*')
      .eq('user_id', uid)
      .single();

    const { data: products } = await supabase
      .from('user_products')
      .select('*')
      .eq('user_id', uid)
      .eq('is_active', true);

    const { data: badges } = await supabase
      .from('user_badges')
      .select('*, badges(*)')
      .eq('user_id', uid);

    res.json({
      success: true,
      data: {
        id: uid,
        email: req.user.email,
        ...profile,
        gamification,
        products: products || [],
        badges: badges || []
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/users/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const { first_name, last_name, mobile, city, age, gender, height_cm, weight_kg, condition, activity_level, doctor_name, blood_group, allergies } = req.body;

    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: uid,
        first_name, last_name, mobile, city,
        age, gender, height_cm, weight_kg,
        condition, activity_level, doctor_name,
        blood_group, allergies,
        updated_at: new Date().toISOString()
      });

    if (error) return res.status(400).json({ success: false, message: error.message });

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/users/register-product
router.post('/register-product', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const { product_code, product_name } = req.body;

    if (!product_name) {
      return res.status(400).json({ success: false, message: 'Please select a product' });
    }

    const code = product_code ? product_code.toUpperCase() : `PC-AUTO-${Date.now()}`;

    // Check if code already used
    if (product_code) {
      const { data: existing } = await supabase
        .from('user_products')
        .select('id')
        .eq('product_code', code)
        .single();
      if (existing) {
        return res.status(409).json({ success: false, message: 'This product code is already registered' });
      }
    }

    await supabase.from('user_products').insert({ user_id: uid, product_code: code, product_name });

    // Award Activator badge
    const { data: badge } = await supabase.from('badges').select('id').eq('condition_type', 'product_registered').single();
    if (badge) await supabase.from('user_badges').upsert({ user_id: uid, badge_id: badge.id });

    // Award 50 coins
    await supabase.rpc('increment_coins', { uid, amount: 50 });

    res.json({ success: true, message: 'Product registered! +50 PhysiCoins 🎉' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/leaderboard
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const { data } = await supabase
      .from('gamification')
      .select('*, user_profiles(first_name, last_name, city)')
      .order('physi_coins', { ascending: false })
      .limit(50);

    res.json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
