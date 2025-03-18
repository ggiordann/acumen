document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileOverlay = document.getElementById('mobile-overlay');
    const mobileClose = document.getElementById('mobile-close');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            if (mobileMenu && mobileOverlay) {
                mobileMenu.classList.add('active');
                mobileOverlay.classList.add('active');
                document.body.style.overflow = 'hidden'; // Prevent scrolling
            }
        });
    }
    
    // Close mobile menu
    if (mobileClose) {
        mobileClose.addEventListener('click', function() {
            if (mobileMenu && mobileOverlay) {
                mobileMenu.classList.remove('active');
                mobileOverlay.classList.remove('active');
                document.body.style.overflow = ''; // Allow scrolling again
            }
        });
    }
    
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', function() {
            if (mobileMenu) {
                mobileMenu.classList.remove('active');
                mobileOverlay.classList.remove('active');
                document.body.style.overflow = ''; // Allow scrolling again
            }
        });
    }

    // FAQ accordion functionality
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                // Close other open FAQs
                faqItems.forEach(otherItem => {
                    if (otherItem !== item && otherItem.classList.contains('active')) {
                        otherItem.classList.remove('active');
                    }
                });
                
                // Toggle current FAQ
                item.classList.toggle('active');
            });
        }
    });

    // Pricing container animation - animate all cards together
    const pricingContainer = document.querySelector('.pricing-container');
    const pricingCards = document.querySelectorAll('.pricing-card');

    // Simple animation that makes the whole container appear at once
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px'
    };

    const containerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Adding a small delay for the container to be visible before animating
                    pricingContainer.classList.add('visible');
                containerObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    if (pricingContainer) {
        containerObserver.observe(pricingContainer);
    }
    
    // Hover effects for cards
    pricingCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.classList.add('hover');
        });
        
        card.addEventListener('mouseleave', () => {
            card.classList.remove('hover');
        });
    });

    // Subscription plan buttons - Stripe redirects
    const planButtons = document.querySelectorAll('.plan-button');
    
    // Stripe product IDs - Replace these with your actual Stripe product IDs
    const stripeProducts = {
        free: null, // No payment for free tier
        plus: 'price_1234567890abcdef', // Example ID for Plus tier
        pro: 'price_2345678901abcdef',  // Example ID for Pro tier
        premium: 'price_3456789012abcdef' // Example ID for Premium tier
    };
    
    // Stripe checkout URLs
    const stripeBaseUrl = 'https://checkout.stripe.com/pay/';
    
    planButtons.forEach(button => {
        const plan = button.getAttribute('data-plan');
        
        // Only add click handlers to paid plans
        if (plan !== 'free') {
            button.addEventListener('click', () => {
                // Add button animation
                button.classList.add('clicked');
                
                // Reset animation after a short delay
                setTimeout(() => {
                    button.classList.remove('clicked');
                }, 300);
                
                // Redirect to Stripe after animation (if not free plan)
                if (stripeProducts[plan]) {
                    setTimeout(() => {
                        // This is where you would redirect to your backend endpoint that creates a Stripe checkout session
                        console.log(`Redirecting to Stripe checkout for ${plan} plan...`);
                        
                        // Example of how you would redirect to your backend
                        // window.location.href = `/create-checkout-session?plan=${plan}`;
                        
                        // Just for demonstration - this would be replaced with your actual Stripe integration
                        alert(`In production, this would redirect to Stripe checkout for the ${plan.toUpperCase()} plan.`);
                    }, 350);
                }
            });
        }
    });

    // Add parallax effect to pricing cards on mouse move
    if (pricingContainer) {
        pricingContainer.addEventListener('mousemove', (e) => {
            const cards = document.querySelectorAll('.pricing-card');
            const rect = pricingContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            cards.forEach(card => {
                const cardRect = card.getBoundingClientRect();
                const cardX = cardRect.left + cardRect.width / 2 - rect.left;
                const cardY = cardRect.top + cardRect.height / 2 - rect.top;
                
                const deltaX = (x - cardX) / 30;
                const deltaY = (y - cardY) / 30;
                
                // Only apply parallax if not on mobile
                if (window.innerWidth > 768) {
                    card.style.transform = `perspective(1000px) rotateY(${-deltaX * 0.5}deg) rotateX(${deltaY * 0.5}deg)`;
                }
            });
        });
        
        // Reset transforms when mouse leaves container
        pricingContainer.addEventListener('mouseleave', () => {
            const cards = document.querySelectorAll('.pricing-card');
            cards.forEach(card => {
                card.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg)';
            });
        });
    }
    
    // Initialize animations on scroll for guarantees section
    const guarantees = document.querySelectorAll('.guarantee-item');
    const guaranteeObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Add staggered animation delay
                setTimeout(() => {
                    entry.target.classList.add('animate-in');
                }, index * 150);
                guaranteeObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });
    
    guarantees.forEach(guarantee => {
        guaranteeObserver.observe(guarantee);
    });
    
    // Fix for login and signup buttons if needed
    const loginBtn = document.querySelector('.login-btn');
    const signupBtn = document.querySelector('.signup-btn');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            window.location.href = '../membership_pages/subs.html';
        });
    }
    
    if (signupBtn) {
        signupBtn.addEventListener('click', function() {
            window.location.href = '../membership_pages/subs.html';
        });
    }
    
    // Ensure mobile menu items have proper links
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
        item.addEventListener('click', function() {
            if (mobileMenu && mobileOverlay) {
                mobileMenu.classList.remove('active');
                mobileOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });
});