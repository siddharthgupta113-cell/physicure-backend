const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const supabase = require('../supabase');

// ─── EXERCISES ───────────────────────────────────────────

// GET /api/content/exercises
router.get('/exercises', auth, async (req, res) => {
  const exercises = [
    { id: 1, name: 'Pelvic Tilts', description: 'Core strengthening for lower back recovery', duration_min: 5, sets: 3, reps: 10, difficulty: 'beginner', condition_tag: 'lower_back' },
    { id: 2, name: 'Cat-Cow Stretch', description: 'Spinal mobility and pain relief', duration_min: 8, sets: 3, reps: 12, difficulty: 'beginner', condition_tag: 'lower_back' },
    { id: 3, name: 'Knee Extensions', description: 'Quad strengthening for knee support', duration_min: 12, sets: 4, reps: 15, difficulty: 'moderate', condition_tag: 'knee' },
    { id: 4, name: 'Neck Isometrics', description: 'Cervical strength and stability', duration_min: 6, sets: 3, reps: 8, difficulty: 'beginner', condition_tag: 'neck' },
    { id: 5, name: 'Ankle Circles', description: 'Range of motion for ankle recovery', duration_min: 4, sets: 2, reps: 20, difficulty: 'beginner', condition_tag: 'ankle' },
    { id: 6, name: 'Hip Bridges', description: 'Glute and lower back strengthening', duration_min: 10, sets: 3, reps: 12, difficulty: 'beginner', condition_tag: 'lower_back' },
    { id: 7, name: 'Straight Leg Raises', description: 'Quad strengthening without knee bend', duration_min: 8, sets: 3, reps: 15, difficulty: 'beginner', condition_tag: 'knee' },
    { id: 8, name: 'Wrist Flexion Stretch', description: 'Wrist mobility and carpal tunnel relief', duration_min: 5, sets: 2, reps: 10, difficulty: 'beginner', condition_tag: 'wrist' }
  ];
  const { condition, difficulty } = req.query;
  let filtered = exercises;
  if (condition) filtered = filtered.filter(e => e.condition_tag === condition);
  if (difficulty) filtered = filtered.filter(e => e.difficulty === difficulty);
  res.json({ success: true, data: filtered });
});

// POST /api/content/exercises/log
router.post('/exercises/log', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const { exercise_name, sets_done, reps_done, duration_min, notes } = req.body;
    if (!exercise_name) return res.status(400).json({ success: false, message: 'Exercise name required' });

    await supabase.from('exercise_logs').insert({
      user_id: uid, exercise_name,
      sets_done, reps_done, duration_min,
      notes: notes || '', coins_earned: 20
    });

    // Award 20 coins + XP
    await supabase.from('gamification')
      .update({ physi_coins: supabase.raw('physi_coins + 20'), total_xp: supabase.raw('total_xp + 20') })
      .eq('user_id', uid);

    // Update daily log
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('daily_logs').upsert({
      user_id: uid, log_date: today, exercise_done: true,
      coins_earned: 20
    }, { onConflict: 'user_id,log_date', ignoreDuplicates: false });

    await checkLevelUp(uid);
    res.json({ success: true, message: 'Exercise logged! +20 PhysiCoins 💪', coins_earned: 20 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DIET ────────────────────────────────────────────────

// GET /api/content/diet
router.get('/diet', auth, async (req, res) => {
  const plans = [
    { meal_type: 'breakfast', name: 'Recovery Starter', calories: 380, protein_g: 14, carbs_g: 48, fat_g: 9, items: ['Oats porridge', 'Banana + almonds', 'Turmeric milk'] },
    { meal_type: 'lunch', name: 'Anti-inflammatory Bowl', calories: 470, protein_g: 22, carbs_g: 65, fat_g: 8, items: ['Dal + brown rice', 'Spinach sabzi', 'Curd'] },
    { meal_type: 'snack', name: 'Protein Snack', calories: 225, protein_g: 18, carbs_g: 18, fat_g: 9, items: ['Boiled eggs (2)', 'Multigrain toast', 'Green tea'] },
    { meal_type: 'dinner', name: 'Light Recovery Meal', calories: 350, protein_g: 36, carbs_g: 28, fat_g: 7, items: ['Grilled chicken', 'Vegetable soup', 'Whole wheat roti'] }
  ];
  res.json({ success: true, data: plans });
});

// ─── SUPPLEMENTS ─────────────────────────────────────────

// GET /api/content/supplements
router.get('/supplements', auth, async (req, res) => {
  const supplements = [
    { id: 1, name: 'Joint Care Plus', description: 'Glucosamine, Chondroitin & MSM', price: 699, quantity_label: '60 tablets', category: 'joint' },
    { id: 2, name: 'Collagen Peptides', description: 'Hydrolysed type 1 & 3 collagen', price: 849, quantity_label: '30 servings', category: 'recovery' },
    { id: 3, name: 'Turmeric Curcumin', description: 'High-potency curcumin with piperine', price: 549, quantity_label: '90 capsules', category: 'anti-inflammatory' },
    { id: 4, name: 'Vitamin D3 + K2', description: 'Cholecalciferol 2000IU with MK-7', price: 399, quantity_label: '60 capsules', category: 'vitamins' },
    { id: 5, name: 'Magnesium Glycinate', description: 'Highly bioavailable magnesium', price: 599, quantity_label: '60 capsules', category: 'minerals' },
    { id: 6, name: 'Omega-3 Fish Oil', description: 'EPA + DHA from deep sea fish', price: 749, quantity_label: '90 softgels', category: 'omega' }
  ];
  res.json({ success: true, data: supplements });
});

// POST /api/content/supplements/order
router.post('/supplements/order', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const { items, address, payment_method, coins_to_use } = req.body;
    if (!items || !items.length) return res.status(400).json({ success: false, message: 'No items in order' });

    const { error } = await supabase.from('orders').insert({
      user_id: uid, items, address,
      total_amount: items.reduce((sum, i) => sum + (i.price * i.quantity), 0),
      payment_method: payment_method || 'cod',
      coins_used: coins_to_use || 0
    });

    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, message: 'Order placed successfully! 🛒' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DAILY LOG / GAMIFICATION ─────────────────────────────

// POST /api/content/daily-log
router.post('/daily-log', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const { wore_belt, notes } = req.body;

    // Check if already logged today
    const { data: existing } = await supabase
      .from('daily_logs')
      .select('id, wore_belt')
      .eq('user_id', uid)
      .eq('log_date', today)
      .single();

    const alreadyLogged = existing?.wore_belt === true;
    const coinsEarned = wore_belt && !alreadyLogged ? 50 : 0;

    await supabase.from('daily_logs').upsert({
      user_id: uid, log_date: today,
      wore_belt: wore_belt || false,
      notes: notes || '',
      coins_earned: (existing?.coins_earned || 0) + coinsEarned
    }, { onConflict: 'user_id,log_date' });

    if (coinsEarned > 0) {
      // Add coins + XP
      const { data: gam } = await supabase.from('gamification').select('physi_coins, total_xp, current_streak').eq('user_id', uid).single();
      if (gam) {
        const newStreak = gam.current_streak + 1;
        await supabase.from('gamification').update({
          physi_coins: gam.physi_coins + coinsEarned,
          total_xp: gam.total_xp + coinsEarned,
          current_streak: newStreak,
          longest_streak: Math.max(gam.longest_streak || 0, newStreak),
          last_belt_log: today,
          updated_at: new Date().toISOString()
        }).eq('user_id', uid);

        // Check streak badges
        for (const target of [7, 30]) {
          if (newStreak >= target) {
            const { data: badge } = await supabase.from('badges').select('id').eq('condition_type', 'streak').eq('condition_value', target).single();
            if (badge) await supabase.from('user_badges').upsert({ user_id: uid, badge_id: badge.id }, { ignoreDuplicates: true });
          }
        }
      }
    }

    await checkLevelUp(uid);
    const { data: updatedGam } = await supabase.from('gamification').select('*').eq('user_id', uid).single();

    res.json({
      success: true,
      message: coinsEarned > 0 ? `Belt logged! +${coinsEarned} PhysiCoins 🔥` : 'Already logged today',
      coins_earned: coinsEarned,
      gamification: updatedGam
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/content/gamification
router.get('/gamification', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const { data: gam } = await supabase.from('gamification').select('*').eq('user_id', uid).single();

    // Last 7 days
    const logs = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const { data: log } = await supabase.from('daily_logs').select('wore_belt').eq('user_id', uid).eq('log_date', dateStr).single();
      logs.push({ date: dateStr, wore_belt: log?.wore_belt || false });
    }

    const { data: badges } = await supabase.from('user_badges').select('*, badges(*)').eq('user_id', uid);

    res.json({ success: true, data: { ...gam, week_log: logs, badges: badges || [] } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/content/appointments
router.post('/appointments', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const { doctor_name, speciality, appointment_date, notes } = req.body;

    await supabase.from('appointments').insert({
      user_id: uid, doctor_name,
      speciality: speciality || 'Physiotherapy',
      appointment_date, notes: notes || '',
      coins_used: 0
    });

    // Award 40 coins
    const { data: gam } = await supabase.from('gamification').select('physi_coins, total_xp').eq('user_id', uid).single();
    if (gam) {
      await supabase.from('gamification').update({
        physi_coins: gam.physi_coins + 40,
        total_xp: gam.total_xp + 40
      }).eq('user_id', uid);
    }

    // First consult badge
    const { data: badge } = await supabase.from('badges').select('id').eq('condition_type', 'appointment').single();
    if (badge) await supabase.from('user_badges').upsert({ user_id: uid, badge_id: badge.id }, { ignoreDuplicates: true });

    await checkLevelUp(uid);
    res.json({ success: true, message: 'Appointment booked! +40 PhysiCoins 🩺' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── HELPER ───────────────────────────────────────────────
async function checkLevelUp(uid) {
  const { data: gam } = await supabase.from('gamification').select('total_xp').eq('user_id', uid).single();
  if (!gam) return;
  const xp = gam.total_xp;
  const thresholds = [
    { level: 1, min: 0, title: 'Bronze Beginner' },
    { level: 2, min: 200, title: 'Silver Healer' },
    { level: 3, min: 500, title: 'Gold Healer' },
    { level: 4, min: 1000, title: 'Gold Healer II' },
    { level: 5, min: 1800, title: 'Platinum Warrior' },
    { level: 6, min: 3000, title: 'Diamond Champion' }
  ];
  let current = thresholds[0];
  for (const t of thresholds) { if (xp >= t.min) current = t; }
  await supabase.from('gamification').update({ level: current.level, rank_title: current.title }).eq('user_id', uid);
}

module.exports = router;
