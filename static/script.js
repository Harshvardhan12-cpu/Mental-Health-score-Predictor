/* ============================================================
   MENTAL HEALTH PREDICTOR — PREMIUM SCRIPT
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    /* ── DOM References ───────────────────────────────────────── */
    const form          = document.getElementById('predictionForm');
    const circle        = document.getElementById('scoreCircle');
    const scoreDisplay  = document.getElementById('scoreValue');
    const statusText    = document.getElementById('resultStatus');
    const submitBtn     = document.getElementById('submitBtn');
    const btnLabel      = document.getElementById('btnLabel');
    const scoreCat      = document.getElementById('scoreCategory');
    const themeToggle   = document.getElementById('themeToggle');
    const themeLabel    = document.getElementById('themeLabel');
    const html          = document.documentElement;

    /* ── SVG Gauge Math ───────────────────────────────────────── */
    const radius       = circle.r.baseVal.value;          // 90
    const circumference = 2 * Math.PI * radius;           // ~565.5

    circle.style.strokeDasharray  = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference;        // starts empty

    /* ── Theme Toggle ─────────────────────────────────────────── */
    // Default to dark
    let isDark = html.getAttribute('data-theme') === 'dark';

    function applyTheme(dark) {
        html.setAttribute('data-theme', dark ? 'dark' : 'light');
        themeLabel.textContent = dark ? 'Light' : 'Dark';
        isDark = dark;
        localStorage.setItem('mhp-theme', dark ? 'dark' : 'light');
    }

    // Restore saved preference
    const savedTheme = localStorage.getItem('mhp-theme');
    if (savedTheme) applyTheme(savedTheme === 'dark');

    themeToggle.addEventListener('click', () => applyTheme(!isDark));

    /* ── Score Category Helper ────────────────────────────────── */
    const CATEGORIES = [
        { min: 8,   label: 'Excellent',  cls: 'cat-excellent' },
        { min: 6,   label: 'Good',       cls: 'cat-good'      },
        { min: 4,   label: 'Fair',       cls: 'cat-fair'      },
        { min: 0,   label: 'Needs Work', cls: 'cat-low'       },
    ];

    function getCategory(score) {
        return CATEGORIES.find(c => score >= c.min) || CATEGORIES[CATEGORIES.length - 1];
    }

    /* ── Gauge Animation ──────────────────────────────────────── */
    function setScore(score) {
        const clampedScore = Math.max(0, Math.min(10, Number(score)));
        const offset = circumference - (clampedScore / 10) * circumference;

        // Animate ring
        circle.style.transition      = 'stroke-dashoffset 1.1s cubic-bezier(0.4, 0, 0.2, 1)';
        circle.style.strokeDashoffset = offset;

        // Count-up number
        animateScoreText(clampedScore);

        // Score category badge
        const cat = getCategory(clampedScore);
        scoreCat.textContent = cat.label;
        scoreCat.className   = `score-category ${cat.cls}`;

        // Trigger visibility with a slight delay for drama
        setTimeout(() => scoreCat.classList.add('visible'), 600);
    }

    function animateScoreText(target) {
        const duration  = 1100;
        const stepTime  = 18;
        const steps     = duration / stepTime;
        const increment = target / steps;
        let   current   = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            scoreDisplay.textContent = current.toFixed(1);
        }, stepTime);
    }

    /* ── Reset to Idle State ──────────────────────────────────── */
    function resetGauge() {
        circle.style.transition      = 'stroke-dashoffset 0.5s ease';
        circle.style.strokeDashoffset = circumference;
        scoreDisplay.textContent     = '--';
        scoreCat.className           = 'score-category';
    }

    /* ── Set Loading State ────────────────────────────────────── */
    function setLoading(loading) {
        if (loading) {
            submitBtn.classList.add('loading');
            btnLabel.textContent = 'Analyzing…';
        } else {
            submitBtn.classList.remove('loading');
            btnLabel.textContent = 'Predict My Score';
        }
    }

    /* ── Set Status Message ───────────────────────────────────── */
    function setStatus(msg, type = '') {
        statusText.textContent = msg;
        statusText.className   = `status-text ${type}`;
    }

    /* ── Field Validation ─────────────────────────────────────── */
    function validateForm() {
        let valid = true;
        form.querySelectorAll('.field-input, .field-select').forEach(el => {
            el.classList.remove('invalid');
            if (!el.value || el.value === '') {
                el.classList.add('invalid');
                valid = false;
            }
        });
        return valid;
    }

    // Live-clear invalid state on change
    form.querySelectorAll('.field-input, .field-select').forEach(el => {
        el.addEventListener('input', () => el.classList.remove('invalid'));
        el.addEventListener('change', () => el.classList.remove('invalid'));
    });

    /* ── Form Submit ──────────────────────────────────────────── */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            setStatus('Please fill in all fields before predicting.', 'error');
            return;
        }

        const formData = new FormData(form);

        const payload = {
            Country:                 formData.get('Country'),
            Academic_Level:          formData.get('Academic_Level'),
            Most_Used_Platform:      formData.get('Most_Used_Platform'),
            Purpose_Of_Use:          formData.get('Purpose_Of_Use'),
            Avg_Daily_Usage_Hours:   parseFloat(formData.get('Avg_Daily_Usage_Hours')),
            Study_Hours:             parseFloat(formData.get('Study_Hours')),
            Physical_Activity_Hours: parseFloat(formData.get('Physical_Activity_Hours')),
            Sleep_Hours_Per_Night:   parseFloat(formData.get('Sleep_Hours_Per_Night')),
            Stress_Level:            formData.get('Stress_Level'),
            Age:                     formData.get('Age'),
            Gender:                  formData.get('Gender')
        };

        // UI: loading state
        setLoading(true);
        resetGauge();
        setStatus('Analyzing your data with the AI model…');

        try {
            const response = await fetch('/predict', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
            });

            if (!response.ok) {
                let errMsg = `Server error (HTTP ${response.status})`;
                try {
                    const errData = await response.json();
                    if (errData.message) errMsg = errData.message;
                } catch (_) { /* ignore */ }
                setStatus(`${errMsg}`, 'error');
                setLoading(false);
                return;
            }

            const data = await response.json();

            if (data.status !== 'success' || typeof data.score !== 'number') {
                setStatus('Unexpected response received from server.', 'error');
                setLoading(false);
                return;
            }

            // Success
            setScore(data.score);
            setStatus(`Your mental health wellbeing score is ${data.score} / 10. ${getCategoryNote(data.score)}`, 'success');

        } catch (err) {
            console.error('Fetch error:', err);
            setStatus(
                'Cannot reach the backend. Make sure app.py is running on http://127.0.0.1:5000.',
                'error'
            );
        } finally {
            setLoading(false);
        }
    });

    /* ── Category Note Helper ─────────────────────────────────── */
    function getCategoryNote(score) {
        if (score >= 8)   return 'Great job — keep it up!';
        if (score >= 6)   return 'You are doing well overall.';
        if (score >= 4)   return 'Consider small lifestyle improvements.';
        return 'Prioritize self-care and seek support if needed.';
    }

});
