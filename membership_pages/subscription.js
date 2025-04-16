document.addEventListener('DOMContentLoaded', async function() {
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileOverlay = document.getElementById('mobile-overlay');
    const mobileClose = document.getElementById('mobile-close');

    //function to initialise firebase
    async function initFirebase() {
        try {
            const response = await fetch('http://localhost:1989/get-api-key');
            const data = await response.json();
            const firebaseConfig = data.firebaseConfig;
            
            // Initialize Firebase
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase initialized successfully');
            
            // Set persistence to LOCAL for persistent login across browser restarts
            firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                .then(() => {
                    console.log("Persistence set to LOCAL");
                })
                .catch((error) => {
                    console.error("Error setting persistence:", error);
                });
            
            // Check if user is already logged in
            firebase.auth().onAuthStateChanged(function(user) {
                // Once auth state is determined (either way), remove loading overlay with smooth transition
                setTimeout(function() {
                    $(".auth-loading-overlay").css("opacity", "0");
                    
                    setTimeout(function() {
                        $(".auth-container").removeClass("loading");
                        $(".auth-loading-overlay").remove();
                    }, 600); // Extended from 400ms to 600ms for longer fade-in effect
                }, 500); // Extended from 300ms to 500ms for longer initial delay
                
                if (user) {
                    console.log("User is signed in:", user.displayName);
                    // Update UI to show user is logged in
                    updateUIForLoggedInUser(user);
                    
                    // Make sure their token is fresh
                    user.getIdToken(true).then(function(idToken) {
                        console.log("Fresh token obtained");
                    });
                } else {
                    console.log("No user is signed in");
                    // Optionally redirect to login page
                    // window.location.href = '../membership_pages/subs.html?redirect=subscription';
                }
            });
        } catch (error) {
            console.error('Error initializing Firebase:', error);
        }
    }
    
    // Function to update UI elements when user is logged in
    async function updateUIForLoggedInUser(user) {
        try {
            // Get user's subscription data from the backend
            const idToken = await user.getIdToken(true);
            const response = await fetch(`http://localhost:1989/get-user-subscription?uid=${user.uid}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            
            if (response.ok) {
                const userData = await response.json();
                const subscription = userData.subscription;
                
                // Check for existing auth container 
                if ($(".auth-container").length) {
                    // Clear auth container
                    $(".auth-container").empty();
                    
                    // Get user photo URL with proper fallback
                    // || 'https://via.placeholder.com/30'
                    // onerror="this.src='https://via.placeholder.com/30'; console.log('Failed to load profile image, using placeholder'); this.onerror=null;
                    const photoURL = user.photoURL;
                    console.log("User photo URL in subscription:", photoURL);
                    
                    // Add user profile UI - matching main.js implementation exactly
                    $(".auth-container").append(`
                        <div class="user-profile-container">
                            <button class="user-profile-btn">
                                <img src="${photoURL}" alt="${user.displayName}" class="user-avatar" 
                                     >
                                <span>${user.displayName}</span>
                            </button>
                            <div class="user-dropdown">
                                <a href="../app/index.html" class="dropdown-item">Dashboard</a>
                                <a href="../membership_pages/account-settings.html" class="dropdown-item">Account Settings</a>
                                <a href="#" class="dropdown-item" id="subscription-settings">Subscription</a>
                                <a href="#" class="dropdown-item" id="logout-btn">Sign Out</a>
                            </div>
                        </div>
                    `);
                    
                    // Determine correct display level - ensure Premium is shown properly
                    let displayLevel = subscription.subscriptionLevel.toLowerCase();
                    
                    // If the plan is stored as 'pro' but should be 'premium', correct it
                    if (displayLevel === 'pro' && (
                        (subscription.features && subscription.features.includes('premium')) || 
                        (subscription.price && subscription.price > 15)
                    )) {
                        displayLevel = 'premium';
                        console.log("Corrected subscription level from 'pro' to 'premium'");
                    }
                    
                    const badgeClass = `${displayLevel}-badge`;
                    const planName = displayLevel.toUpperCase();
                    const planBadge = $(`<span class="subscription-badge ${badgeClass}">${planName}</span>`);
                    $(".user-profile-btn span").append(" ").append(planBadge);
                    
                    // Initialize dropdown toggle
                    $(".user-profile-btn").click(function(e) {
                        e.stopPropagation();
                        $(".user-dropdown").toggleClass("show");
                    });
                    
                    // Close dropdown when clicking elsewhere
                    $(document).click(function() {
                        $(".user-dropdown").removeClass("show");
                    });
                    
                    // Handle logout
                    $("#logout-btn").click(function(e) {
                        e.preventDefault();
                        firebase.auth().signOut().then(() => {
                            console.log("User signed out");
                            window.location.reload();
                        }).catch(error => {
                            console.error("Error signing out:", error);
                        });
                    });
                } else {
                    console.warn("Auth container not found in the DOM");
                }
                
                // Update mobile menu to show user is logged in
                updateMobileMenuForLoggedInUser(user, subscription);
                
                // Highlight the current plan - use the corrected level name for highlighting
                const displayLevel = subscription.subscriptionLevel.toLowerCase() === 'pro' && 
                                   ((subscription.features && subscription.features.includes('premium')) || 
                                    (subscription.price && subscription.price > 15))
                                    ? 'premium' : subscription.subscriptionLevel.toLowerCase();
                highlightCurrentPlan(displayLevel);
            }
        } catch (error) {
            console.error('Error fetching user subscription data:', error);
        }
    }
    
    // Update mobile menu for logged in users
    function updateMobileMenuForLoggedInUser(user, subscription) {
        const mobileAuthSection = $(".mobile-menu .mobile-section:last-child");
        if (mobileAuthSection.length) {
            // Get user photo URL with proper fallback - same as main.js
            // || 'https://via.placeholder.com/30'
            // onerror="this.src='https://via.placeholder.com/30'; console.log('Failed to load mobile profile image, using placeholder'); this.onerror=null;"
            const photoURL = user.photoURL;
            
            mobileAuthSection.html(`
                <div class="mobile-section-title">Account</div>
                <div class="mobile-user-info">
                    <img src="${photoURL}" class="mobile-avatar" 
                         >
                    <span>${user.displayName}</span>
                </div>
                <a href="../app/index.html" class="mobile-nav-item">
                    <div class="icon"><i class="fas fa-home"></i></div>
                    <span>Dashboard</span>
                </a>
                <a href="../membership_pages/account-settings.html" class="mobile-nav-item">
                    <div class="icon"><i class="fas fa-user-cog"></i></div>
                    <span>Account Settings</span>
                </a>
                <a href="#" class="mobile-nav-item" id="mobile-logout">
                    <div class="icon"><i class="fas fa-sign-out-alt"></i></div>
                    <span>Sign Out</span>
                </a>
            `);
            
            // Determine correct display level - ensure Premium is shown properly
            let displayLevel = subscription.subscriptionLevel.toLowerCase();
            
            // If the plan is stored as 'pro' but should be 'premium', correct it
            if (displayLevel === 'pro' && (
                (subscription.features && subscription.features.includes('premium')) || 
                (subscription.price && subscription.price > 15)
            )) {
                displayLevel = 'premium';
            }
            
            // Add subscription badge to mobile menu
            const badgeClass = `${displayLevel}-badge`;
            const planName = displayLevel.toUpperCase();
            mobileAuthSection.find(".mobile-user-info span").append(` <span class="subscription-badge ${badgeClass}">${planName}</span>`);
            
            // Handle mobile logout
            $("#mobile-logout").click(function(e) {
                e.preventDefault();
                firebase.auth().signOut().then(() => {
                    console.log("User signed out from mobile menu");
                    window.location.reload();
                }).catch(error => {
                    console.error("Error signing out from mobile menu:", error);
                });
            });
        }
    }
    
    // Function to highlight the user's current subscription plan
    function highlightCurrentPlan(plan) {
        // Remove existing highlight from all plans
        $(".pricing-option").removeClass("current-plan");
        
        // Add highlight to current plan
        $(`.pricing-option[data-plan="${plan}"]`).addClass("current-plan");
        console.log(`Highlighted plan: ${plan}`);
    }
    
    // Initialize Firebase when the page loads
    initFirebase();
    
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

    planButtons.forEach(button => {
        const plan = button.getAttribute('data-plan');
        
        // Only add click handlers to paid plans
        if (plan !== 'free') {
            button.addEventListener('click', async () => {
                // Add button animation
                button.classList.add('clicked');
                
                // Check if Firebase is initialized
                if (typeof firebase === 'undefined') {
                    console.error('Firebase is not initialized yet');
                    alert('Authentication service is not ready yet. Please try again in a moment.');
                    button.classList.remove('clicked');
                    return;
                }
                
                try {
                    // Get current user if logged in
                    const currentUser = firebase.auth().currentUser;
                    if (!currentUser) {
                        // Redirect to login if no user is signed in
                        window.location.href = '../membership_pages/subs.html?redirect=subscription';
                        return;
                    }
                    
                    // Show loading state
                    button.disabled = true;
                    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                    
                    // Create checkout session
                    const response = await fetch('http://localhost:1989/create-checkout-session', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            plan: plan,
                            uid: currentUser.uid
                        }),
                    });
                    
                    const session = await response.json();
                    
                    if (session.error) {
                        throw new Error(session.error);
                    }
                    
                    // Redirect to Stripe checkout
                    window.location.href = session.url;
                    
                } catch (error) {
                    console.error('Error:', error);
                    button.innerHTML = 'Try Again';
                    button.disabled = false;
                    alert('There was an error processing your request. Please try again.');
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