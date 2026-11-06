// ═══════════════════════════════════════════════════════════════
//  HOME PAGE — navbar, scroll effects, counter animation
//  Uses async/await throughout · clean & readable
// ═══════════════════════════════════════════════════════════════

// ── DOM Elements ──────────────────────────────────────────────
const navbar      = document.getElementById('navbar');
const hamburger   = document.getElementById('nav-hamburger');
const navMenu     = document.getElementById('nav-menu');
const navLinks    = document.querySelectorAll('.nav-menu .nav-link');
const heroParticles = document.getElementById('hero-particles');

// ── Redirect if already logged in ─────────────────────────────
function checkExistingSession() {
    const token = localStorage.getItem('token');
    const user  = localStorage.getItem('currentUser');

    if (!token || !user) return; // not logged in

    try {
        const parsed = JSON.parse(user);
        if (parsed.role === 'admin') {
            window.location.href = 'admin-dashboard.html';
        } else {
            window.location.href = 'student-dashboard.html';
        }
    } catch {
        // invalid JSON in storage — ignore
    }
}
checkExistingSession();

// ── Mobile Menu Toggle ────────────────────────────────────────
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('open');
});

// Close menu when a link is clicked
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('open');
    });
});

// ── Navbar scroll effect ──────────────────────────────────────
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// ── Active nav link on scroll ─────────────────────────────────
function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const scrollPos = window.scrollY + 100;

    sections.forEach(section => {
        const top    = section.offsetTop;
        const height = section.offsetHeight;
        const id     = section.getAttribute('id');

        if (scrollPos >= top && scrollPos < top + height) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${id}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}
window.addEventListener('scroll', updateActiveNavLink);

// ── Smooth scroll for anchor links ────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        const targetId = anchor.getAttribute('href');
        if (targetId === '#') return;

        e.preventDefault();
        const target = document.querySelector(targetId);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ── Animated stat counters ────────────────────────────────────
function animateCounters() {
    const counters = document.querySelectorAll('.hero-stat-number[data-count]');

    counters.forEach(counter => {
        const target   = parseInt(counter.dataset.count, 10);
        const duration = 2000; // ms
        const step     = Math.ceil(target / (duration / 16));
        let current    = 0;

        const tick = () => {
            current += step;
            if (current >= target) {
                counter.textContent = target;
                return;
            }
            counter.textContent = current;
            requestAnimationFrame(tick);
        };

        tick();
    });
}

// ── Scroll-reveal for sections ────────────────────────────────
function setupScrollReveal() {
    // Add .reveal to all cards and steps
    const revealTargets = document.querySelectorAll(
        '.feature-card, .step, .contact-card'
    );
    revealTargets.forEach(el => el.classList.add('reveal'));

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.15 }
    );

    revealTargets.forEach(el => observer.observe(el));
}

// ── Floating particles in hero ────────────────────────────────
function createParticles() {
    if (!heroParticles) return;

    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'hero-particle';
        particle.style.left   = `${Math.random() * 100}%`;
        particle.style.top    = `${Math.random() * 100}%`;
        particle.style.width  = `${4 + Math.random() * 6}px`;
        particle.style.height = particle.style.width;
        particle.style.animationDelay    = `${Math.random() * 10}s`;
        particle.style.animationDuration = `${8 + Math.random() * 8}s`;
        heroParticles.appendChild(particle);
    }
}

// ── Counter trigger on hero visible ───────────────────────────
function setupCounterTrigger() {
    const hero = document.getElementById('hero');
    if (!hero) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.3 }
    );

    observer.observe(hero);
}

// ── Initialize everything ─────────────────────────────────────
function init() {
    createParticles();
    setupScrollReveal();
    setupCounterTrigger();
}

init();
