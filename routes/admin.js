const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const supabase = require('../supabase');

// GET /api/admin/dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const { count: totalUsers } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true });
    const { count: totalProducts } = await supabase.from('user_products').select('*', { count: 'exact', head: true });
    const { count: totalOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    const { count: totalAppointments } = await supabase.from('appointments').select('*', { count: 'exact', head: true });
    const { data: coinsData } = await supabase.from('gamification').select('physi_coins');
    const totalCoins = coinsData?.reduce((sum, r) => sum + (r.physi_coins || 0), 0) || 0;
    const { count: activeStreaks } = await supabase.from('gamification').select('*', { count: 'exact', head: true }).gt('current_streak', 0);

    res.json({
      success: true,
      data: { totalUsers, totalProducts, totalOrders, totalAppointments, totalCoins, activeStreaks }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/users
router.get('/users', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('user_profiles')
      .select('*, gamification(physi_coins, current_streak, level, rank_title), user_products(product_name, product_code)', { count: 'exact' })
      .range(from, to)
      .order('updated_at', { ascending: false });

    if (search) query = query.or(`first_name.ilike.%${search}%,mobile.ilike.%${search}%`);

    const { data, count, error } = await query;
    if (error) return res.status(400).json({ success: false, message: error.message });

    res.json({ success: true, data, pagination: { page: Number(page), limit: Number(limit), total: count } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', auth, async (req, res) => {
  try {
    const uid = req.params.id;
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', uid).single();
    const { data: gamification } = await supabase.from('gamification').select('*').eq('user_id', uid).single();
    const { data: products } = await supabase.from('user_products').select('*').eq('user_id', uid);
    const { data: logs } = await supabase.from('daily_logs').select('*').eq('user_id', uid).order('log_date', { ascending: false }).limit(30);
    const { data: orders } = await supabase.from('orders').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    const { data: appointments } = await supabase.from('appointments').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    const { data: badges } = await supabase.from('user_badges').select('*, badges(*)').eq('user_id', uid);

    res.json({ success: true, data: { ...profile, gamification, products, daily_logs: logs, orders, appointments, badges } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/products
router.get('/products', auth, async (req, res) => {
  try {
    const { data } = await supabase
      .from('user_products')
      .select('*, user_profiles(first_name, last_name, mobile, city)')
      .order('purchased_at', { ascending: false });
    res.json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
