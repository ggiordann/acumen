import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Force scroll to top when page loads/reloads
window.onload = function() {
    window.scrollTo(0, 0);
};

// Also force scroll reset on page visibility change (e.g., when returning to the tab)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && scrollingPastAnimation) {
        // If returning to the page and content is visible, reset scroll position
        contentPage.scrollTop = 0;
        window.scrollTo(0, 0);
    }
});

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    45, // Field of view in degrees
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near clipping plane
    1000 // Far clipping plane
);

// Renderer setup with improved quality
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: "high-performance",
    alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000); // Black background
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
renderer.outputEncoding = THREE.sRGBEncoding;

// Enhance rendering resolution for sharper details
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

document.getElementById('container').appendChild(renderer.domElement);

// Post-processing for enhanced visual quality
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Add bloom effect for enhanced lighting highlights
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.3,  // bloom strength
    0.4,  // bloom radius
    0.9   // bloom threshold
);
composer.addPass(bloomPass);

// Define camera animation positions and rotations
const cameraAnimations = {
    start: {
        position: new THREE.Vector3(0, 15, 15),
        lookAt: new THREE.Vector3(0, 10, 10),
    },
    end: {
        position: new THREE.Vector3(0, 4.5, -4.9),
        lookAt: new THREE.Vector3(0, -2.9, -8.9),
    }
};

// Initial camera position
camera.position.copy(cameraAnimations.start.position);
camera.lookAt(cameraAnimations.start.lookAt);

// Add the specified point lights with improved quality
const pointLight1 = new THREE.PointLight(0xffffff, 20.0, 50);
pointLight1.position.set(0, 4.269, -0.134);
pointLight1.castShadow = true;
pointLight1.shadow.mapSize.width = 2048;
pointLight1.shadow.mapSize.height = 2048;
pointLight1.shadow.bias = -0.0001;
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0xffffff, 30.0, 50);
pointLight2.position.set(-2.284, 2.877, 4.634);
pointLight2.castShadow = true;
pointLight2.shadow.mapSize.width = 2048;
pointLight2.shadow.mapSize.height = 2048;
pointLight2.shadow.bias = -0.0001;
scene.add(pointLight2);

// Add a subtle ambient light to improve overall visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// Create environment map for better reflections
const envMapTextureUrls = [
    'https://threejs.org/examples/textures/cube/Park3Med/px.jpg',
    'https://threejs.org/examples/textures/cube/Park3Med/nx.jpg',
    'https://threejs.org/examples/textures/cube/Park3Med/py.jpg',
    'https://threejs.org/examples/textures/cube/Park3Med/ny.jpg',
    'https://threejs.org/examples/textures/cube/Park3Med/pz.jpg',
    'https://threejs.org/examples/textures/cube/Park3Med/nz.jpg'
];

const cubeTextureLoader = new THREE.CubeTextureLoader();
const envMap = cubeTextureLoader.load(envMapTextureUrls);
scene.environment = envMap;
scene.background = null; // Keep black background

// Handle loading screen
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');

// Model and animation variables
let mixer;
let model;
let animations = [];
let actions = [];
let totalDuration = 0;
let animationProgress = 0;
let animationComplete = false;
let scrollingPastAnimation = false;

// Reference to content page
const contentPage = document.getElementById('content-page');
const infoElement = document.getElementById('info');

// Load the GLB model
const loader = new GLTFLoader();
loader.load(
    'models/laptop_animation1.glb',
    (gltf) => {
        model = gltf.scene;
        scene.add(model);
        
        // Setup model to cast and receive shadows with improved material quality
        model.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                
                // Improve material quality for realistic rendering
                if (node.material) {
                    // Enable environment map reflections
                    node.material.envMap = envMap;
                    node.material.envMapIntensity = 1.5;
                    
                    // Apply specific material settings for Apple logo
                    if (node.name.includes('logo') || node.name.includes('apple')) {
                        node.material.metalness = 1.0;
                        node.material.roughness = 0.05;
                        node.material.envMapIntensity = 2.0;
                        node.material.clearcoat = 1.0;
                        node.material.clearcoatRoughness = 0.1;
                    }
                    // Increase metalness for laptop parts that should be metallic
                    else if (node.name.includes('metal') || 
                        node.name.includes('keyboard') ||
                        node.name.includes('body')) {
                        node.material.metalness = 0.9;
                        node.material.roughness = 0.15;
                    }
                    
                    // Make screen more glossy
                    else if (node.name.includes('screen') || node.name.includes('display')) {
                        node.material.metalness = 0.1;
                        node.material.roughness = 0.05;
                        node.material.clearcoat = 0.5;
                        node.material.clearcoatRoughness = 0.02;
                    }
                    
                    // Add normal intensity if available to enhance surface details
                    if (node.material.normalMap) {
                        node.material.normalScale.set(1.5, 1.5);
                    }
                    
                    node.material.needsUpdate = true;
                }
            }
        });

        // Animation setup
        mixer = new THREE.AnimationMixer(model);
        animations = gltf.animations;
        
        // Get total duration by finding the longest animation
        animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            actions.push(action);
            
            // Make sure animations don't loop
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = true;
            action.play();
            
            // Pause at the beginning
            action.paused = true;
            
            // Update total duration if this animation is longer
            totalDuration = Math.max(totalDuration, clip.duration);
        });
        
        // Hide loading screen with fade effect
        setTimeout(() => {
            loadingScreen.style.opacity = 0;
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 1000);
        }, 3000);  // extended initial delay to 3s for slower deployments
    },
    (xhr) => {
        // Update loading bar
        const percentComplete = xhr.loaded / xhr.total * 100;
        loadingBar.style.width = percentComplete + '%';
    },
    (error) => {
        console.error('Error loading model:', error);
    }
);

// Function to update camera position based on animation progress
function updateCameraPosition(progress) {
    // Normalise progress to 0-1 range
    const normalizedProgress = progress / totalDuration;
    
    // Interpolate position
    camera.position.lerpVectors(
        cameraAnimations.start.position,
        cameraAnimations.end.position,
        normalizedProgress
    );
    
    // Interpolate lookAt target
    const currentLookAt = new THREE.Vector3().lerpVectors(
        cameraAnimations.start.lookAt,
        cameraAnimations.end.lookAt,
        normalizedProgress
    );
    
    camera.lookAt(currentLookAt);
    
    // Check if animation is complete (100%)
    if (normalizedProgress >= 1.0 && !animationComplete) {
        animationComplete = true;
        prepareContentTransition();
    }
}

// Function to prepare for content transition
function prepareContentTransition() {
    // Make content page immediately visible
    contentPage.style.visibility = 'visible';
    contentPage.style.opacity = '1';
    
    // Set the background to black during transition
    document.body.style.backgroundColor = '#000000';
    contentPage.style.backgroundColor = '#000000';
    
    // Hide the info element
    if (infoElement) {
        infoElement.style.opacity = 0;
    }
    
    // Make navbar visible during transition
    const navbar = document.getElementById('main-navbar');
    if (navbar) {
        navbar.style.opacity = '1';
        navbar.style.transform = 'translateY(0)';
    }
    
    // Completely hide the 3D scene
    renderer.domElement.style.opacity = 0;
    
    // Change scroll behavior to allow scrolling the content
    scrollingPastAnimation = true;
    
    // Set body height to allow continued scrolling
    document.body.style.height = '600vh';
    
    // Reset scroll position for both window and content page
    window.scrollTo(0, 0);
    contentPage.scrollTop = 0;
    
    // Add history entry to prevent back-button from restoring scroll position
    if (history.scrollRestoration) {
        history.scrollRestoration = 'manual';
    }
    
    // Add a small delay to ensure scroll reset takes effect
    setTimeout(() => {
        window.scrollTo(0, 0);
        contentPage.scrollTop = 0;
        
        // Initialise content page features
        initContentFeatures();
    }, 50);
}

// Handle scroll events to control animation
window.addEventListener('wheel', (e) => {
    if (scrollingPastAnimation) {
        return;
    }
    
    if (!mixer || !actions.length || animationComplete) return;
    
    e.preventDefault();
    
    // Control animation progress based on scroll
    const scrollMultiplier = 0.001;
    animationProgress += e.deltaY * scrollMultiplier;
    
    // Clamp the progress between 0 and totalDuration
    animationProgress = Math.max(0, Math.min(totalDuration, animationProgress));
    
    // Update all animations to the same time position
    actions.forEach(action => {
        action.time = animationProgress;
    });
    
    // Update camera position based on progress
    updateCameraPosition(animationProgress);
    
    // Force mixer update to display the new position
    mixer.update(0);
});

// Alternative scroll method to ensure smoother control
window.addEventListener('scroll', () => {
    if (scrollingPastAnimation) {
        // After animation is complete, handle reveal animations on scroll
        handleScrollAnimations();
        return;
    }
    
    if (!mixer || !actions.length || animationComplete) return;
    
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Map scroll position to animation progress
    const pageHeight = document.body.scrollHeight - window.innerHeight;
    animationProgress = (scrollTop / pageHeight) * totalDuration;
    
    // Update all animations to the same time position
    actions.forEach(action => {
        action.time = animationProgress;
    });
    
    // Update camera position based on progress
    updateCameraPosition(animationProgress);
    
    // Force mixer update to display the new position
    mixer.update(0);
});

// Animation loop
function animate() {
    if (!animationComplete) {
        composer.render();
    }
    requestAnimationFrame(animate);
}

// Start the animation loop
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// ============== Content Page Feature Initialization =============== //

// Initialise all content features
function initContentFeatures() {
    // Initialise mobile menu functionality
    initMobileMenu();
    
    // Initialise reveal animations for elements
    initRevealAnimations();
    
    // Initialise statistics counter animations
    initStatCounters();
    
    // Initialise FAQ accordion functionality
    initFaqAccordion();
    
    // Initialise smooth scrolling for navigation
    initSmoothScroll();
    
    // Initialise pricing card interactivity
    initPricingCards();
    
    // Initialize dropdown menus functionality
    initDropdowns();

    handleTransitionScrollPast();

    // Initialise Authentication State Handling
    initAuthStateObserver();

    // Fetch active users count from Firestore
    /*
    // !!! SECURITY & PERFORMANCE WARNING !!!
    // Reading the entire 'users' collection from the client is insecure and inefficient.
    // This will likely fail due to Firestore security rules (Missing or insufficient permissions).
    // RECOMMENDED APPROACH: Use a Cloud Function triggered by user creation/deletion 
    // to maintain a counter in a separate document (e.g., /metadata/userCount).
    // Then, read only that single document here.
    if (firebase && firebase.firestore) {
        firebase.firestore().collection('users').get()
            .then(snapshot => {
                const count = snapshot.size;
                const span = document.getElementById('active-users');
                if (span) {
                    span.dataset.count = count;
                    span.textContent = count;
                    // Re-initialize the counter animation if needed
                    // initStatCounters(); 
                }
            })
            .catch(err => console.error('Error fetching active users count:', err));
    }
    */
}

// ============== Authentication State Handling =============== //

function initAuthStateObserver() {
    if (!firebase || !firebase.auth) {
        console.error("Firebase Auth not initialized.");
        return;
    }

    firebase.auth().onAuthStateChanged(user => {
        updateNavbarUI(user);
        if (user) {
            fetchUserSubscription(user.uid);
        }
    });
}

function updateNavbarUI(user) {
    const authContainer = document.querySelector('.auth-container');
    const loginBtn = authContainer.querySelector('.login-btn');
    const signupBtn = authContainer.querySelector('.signup-btn');
    const userProfileContainer = authContainer.querySelector('.user-profile-container');
    const userProfileBtn = userProfileContainer.querySelector('.user-profile-btn');
    const userAvatar = userProfileContainer.querySelector('.user-avatar');
    const userNameSpan = userProfileBtn.querySelector('span:not(.subscription-badge)');
    const userDropdown = userProfileContainer.querySelector('.user-dropdown');
    const logoutButton = userDropdown.querySelector('#logout-button-intro');

    // Mobile elements
    const mobileAuthButtons = document.querySelector('.mobile-auth-buttons');
    const mobileUserInfo = document.querySelector('.mobile-user-info');
    const mobileAvatar = mobileUserInfo.querySelector('.mobile-avatar');
    const mobileUsername = mobileUserInfo.querySelector('.mobile-username');
    const mobileAccountLinks = document.querySelector('.mobile-account-links');
    const mobileLogoutButton = mobileAccountLinks.querySelector('#mobile-logout-button-intro');

    if (user) {
        // User is signed in
        loginBtn.style.display = 'none';
        signupBtn.style.display = 'none';
        userProfileContainer.style.display = 'block';

        userAvatar.src = user.photoURL || '../images/default-avatar.png'; // Add a default avatar image
        userNameSpan.textContent = user.displayName || 'User';

        // Mobile UI
        if (mobileAuthButtons) mobileAuthButtons.style.display = 'none';
        if (mobileUserInfo) mobileUserInfo.style.display = 'flex';
        if (mobileAccountLinks) mobileAccountLinks.style.display = 'block';
        if (mobileAvatar) mobileAvatar.src = user.photoURL || '../images/default-avatar.png';
        if (mobileUsername) mobileUsername.textContent = user.displayName || 'User';

        // Add dropdown toggle
        userProfileBtn.onclick = () => userDropdown.classList.toggle('show');
        // Close dropdown if clicked outside
        window.onclick = (event) => {
            if (!userProfileContainer.contains(event.target)) {
                userDropdown.classList.remove('show');
            }
        };

        // Add logout functionality
        logoutButton.onclick = () => firebase.auth().signOut();
        if (mobileLogoutButton) mobileLogoutButton.onclick = () => firebase.auth().signOut();

    } else {
        // User is signed out
        loginBtn.style.display = 'block';
        signupBtn.style.display = 'block';
        userProfileContainer.style.display = 'none';
        userDropdown.classList.remove('show'); // Ensure dropdown is hidden

        // Mobile UI
        if (mobileAuthButtons) mobileAuthButtons.style.display = 'block';
        if (mobileUserInfo) mobileUserInfo.style.display = 'none';
        if (mobileAccountLinks) mobileAccountLinks.style.display = 'none';

        // Remove listeners if they exist to prevent memory leaks
        userProfileBtn.onclick = null;
        logoutButton.onclick = null;
        if (mobileLogoutButton) mobileLogoutButton.onclick = null;
        window.onclick = null; // Be careful if other click listeners are needed
    }
}

async function fetchUserSubscription(userId) {
    try {
        // Use the same API endpoint that is used in other parts of the app
        const apiBaseUrl = "https://useacumen.co";
        const user = firebase.auth().currentUser;
        
        if (!user) return;
        
        // Force token refresh to get latest claims
        const idToken = await user.getIdToken(true);
        
        const response = await fetch(`${apiBaseUrl}/get-user-subscription?uid=${userId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        
        if (response.ok) {
            const userData = await response.json();
            const subscription = userData.subscription;
            
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
            
            updateSubscriptionBadge(displayLevel);
        } else {
            console.error("Error response from subscription endpoint:", response.status);
            updateSubscriptionBadge('free'); // Default to free on error
        }
    } catch (error) {
        console.error("Error fetching user subscription:", error);
        updateSubscriptionBadge('free'); // Default to free on error
    }
}

function updateSubscriptionBadge(plan) {
    const badgeElements = document.querySelectorAll('.subscription-badge');
    badgeElements.forEach(badge => {
        if (!badge) return;
        badge.textContent = plan;
        badge.className = 'subscription-badge'; // Reset classes
        badge.classList.add(`${plan.toLowerCase()}-badge`); // Add specific plan class from style.css
        badge.style.display = 'inline-block';
    });
}

// Initialise mobile menu functionality
function initMobileMenu() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    const mobileClose = document.querySelector('.mobile-close');
    const mobileOverlay = document.querySelector('.mobile-overlay');
    
    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener('click', () => {
            mobileMenu.classList.add('active');
            mobileOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        
        if (mobileClose) {
            mobileClose.addEventListener('click', () => {
                mobileMenu.classList.remove('active');
                mobileOverlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
        
        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', () => {
                mobileMenu.classList.remove('active');
                mobileOverlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
    }
}

// Initialise reveal animations for elements as they scroll into view
function initRevealAnimations() {
    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                element.classList.add('visible');
                revealObserver.unobserve(element);
            }
        });
    }, observerOptions);
    
    const revealElements = document.querySelectorAll('.reveal-element');
    revealElements.forEach(element => {
        const delay = element.dataset.delay || 0;
        setTimeout(() => {
            revealObserver.observe(element);
        }, parseInt(delay));
    });
}

// Check for elements to reveal on scroll
function handleScrollAnimations() {
    const windowHeight = window.innerHeight;
    const scrollY = window.scrollY || window.pageYOffset;
    
    // Check for elements to animate
    document.querySelectorAll('.reveal-element:not(.visible)').forEach(element => {
        const elementTop = element.getBoundingClientRect().top + scrollY;
        const elementVisible = 150;
        
        if (scrollY + windowHeight - elementVisible > elementTop) {
            const delay = element.dataset.delay || 0;
            setTimeout(() => {
                element.classList.add('visible');
            }, parseInt(delay));
        }
    });
}

// Animate stat counters
function initStatCounters() {
    const stats = document.querySelectorAll('.stat-number');
    
    stats.forEach(stat => {
        const target = parseInt(stat.dataset.count);
        const duration = 2000; // milliseconds
        const stepTime = 30;
        const totalSteps = duration / stepTime;
        const stepValue = target / totalSteps;
        let current = 0;
        
        // Only start counter when element is in view
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                const counter = setInterval(() => {
                    current += stepValue;
                    
                    if (current > target) {
                        stat.textContent = target;
                        clearInterval(counter);
                    } else {
                        stat.textContent = Math.floor(current);
                    }
                }, stepTime);
                
                observer.unobserve(stat);
            }
        }, { threshold: 0.5 });
        
        observer.observe(stat);
    });
}

// Initialise FAQ accordion functionality
function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
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
    });
}

// Initialise smooth scrolling for navigation links
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const target = document.querySelector(this.getAttribute('href'));
            
            if (target) {
                const headerOffset = 100;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Initialise pricing card effects and interactions
function initPricingCards() {
    const pricingCards = document.querySelectorAll('.pricing-card');
    
    // Add parallax effect to pricing cards on mouse move
    const pricingContainer = document.querySelector('.pricing-container');
    if (pricingContainer) {
        pricingContainer.addEventListener('mousemove', (e) => {
            if (window.innerWidth <= 768) return; // Don't apply on mobile
            
            const rect = pricingContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            pricingCards.forEach(card => {
                const cardRect = card.getBoundingClientRect();
                const cardX = cardRect.left + cardRect.width / 2 - rect.left;
                const cardY = cardRect.top + cardRect.height / 2 - rect.top;
                
                const deltaX = (x - cardX) / 30;
                const deltaY = (y - cardY) / 30;
                
                card.style.transform = `perspective(1000px) rotateY(${-deltaX * 0.5}deg) rotateX(${deltaY * 0.5}deg)`;
            });
        });
        
        pricingContainer.addEventListener('mouseleave', () => {
            pricingCards.forEach(card => {
                // Reset transform but keep hover effects from CSS
                if (card.classList.contains('popular')) {
                    card.style.transform = 'scale(1.03)';
                } else {
                    card.style.transform = '';
                }
            });
        });
    }
    
    // Add button click effects
    document.querySelectorAll('.plan-button').forEach(button => {
        button.addEventListener('click', function() {
            // Visual feedback
            this.classList.add('clicked');
            
            // Extract plan data
            const plan = this.getAttribute('data-plan');
            console.log(`Selected plan: ${plan}`);

        });
    });
}

// Function to remove the transition space and prevent scrolling back up
function handleTransitionScrollPast() {
    // Create a dedicated transition space element
    const transitionSpace = document.createElement('div');
    transitionSpace.style.height = '100vh';
    transitionSpace.style.width = '100%';
    transitionSpace.style.backgroundColor = '#000000';
    transitionSpace.style.position = 'relative';
    transitionSpace.style.zIndex = '5';
    transitionSpace.id = 'transition-space';
    
    // Get the first element in the content container to insert before it
    const contentContainer = document.querySelector('.content-container');
    const firstContentElement = contentContainer.firstElementChild;
    
    // Insert the transition space at the beginning of the content
    contentContainer.insertBefore(transitionSpace, firstContentElement);
    
    // Remove any padding that was previously set
    contentContainer.style.paddingTop = '0';
    
    // Set proper styles for scrolling
    contentPage.style.position = 'absolute';
    contentPage.style.top = '0';
    contentPage.style.left = '0';
    contentPage.style.height = 'auto';
    contentPage.style.overflowY = 'visible';
    document.body.style.height = 'auto';
    
    // Add a small indicator arrow to show users they should scroll
    const scrollIndicator = document.createElement('div');
    scrollIndicator.innerHTML = `
        <div style="position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); 
                    animation: bounce 2s infinite; color: white; text-align: center;">
            <div style="font-size: 14px; margin-bottom: 10px;">Scroll Down</div>
            <i class="fas fa-chevron-down" style="font-size: 24px;"></i>
        </div>
    `;
    transitionSpace.appendChild(scrollIndicator);
    
    // Add the bounce animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0) translateX(-50%); }
            40% { transform: translateY(-20px) translateX(-50%); }
            60% { transform: translateY(-10px) translateX(-50%); }
        }
    `;
    document.head.appendChild(style);
    
    // Flag to track if transition has been removed
    let transitionRemoved = false;
    
    // Function to check scroll position and handle transition
    function scrollCheck() {
        if (transitionRemoved) return;
        
        const scrollPosition = window.scrollY || window.pageYOffset;
        const viewportHeight = window.innerHeight;
        
        // If scrolled more than 85% of the viewport height, remove the transition space
        if (scrollPosition > viewportHeight * 0.85) {
            console.log("Removing transition space at position:", scrollPosition);
            
            // Temporarily disable scroll events
            window.removeEventListener('scroll', scrollCheck);
            
            // Store current scroll position
            const currentScroll = scrollPosition;
            
            // Remove transition space from DOM
            if (transitionSpace && transitionSpace.parentElement) {
                transitionSpace.parentElement.removeChild(transitionSpace);
            }
            
            // Adjust scroll position to account for removed space
            window.scrollTo(0, currentScroll - viewportHeight);
            
            // Prevent further execution
            transitionRemoved = true;
            
            // Re-enable scrolling
            setTimeout(() => {
                window.addEventListener('scroll', handleScrollAnimations, { passive: true });
            }, 100);
        }
    }
    
    // Add scroll event listener
    window.addEventListener('scroll', scrollCheck, { passive: true });
    
    // Initial check in case page is already scrolled
    scrollCheck();
}

// Initialize dropdown menu functionality
function initDropdowns() {
    // Function has been intentionally emptied to remove dropdown functionality
    // This prevents the Features and Resources dropdowns from being interactive
    console.log("Dropdown functionality disabled as requested");
}

// Check if we should immediately initialize content features
// (in case someone refreshes the page when already in content mode)
document.addEventListener('DOMContentLoaded', () => {
    // Set initial body background to black
    document.body.style.backgroundColor = '#000000';
    
    if (scrollingPastAnimation || 
        (window.location.hash && window.location.hash.length > 1)) {
        initContentFeatures();
    }
    
    // Also add keyboard navigation
    window.addEventListener('keydown', (e) => {
        // If animation complete and arrow keys pressed, scroll
        if (scrollingPastAnimation) {
            if (e.key === 'ArrowDown') {
                window.scrollBy({
                    top: window.innerHeight * 0.5,
                    behavior: 'smooth'
                });
            } else if (e.key === 'ArrowUp') {
                window.scrollBy({
                    top: -window.innerHeight * 0.5,
                    behavior: 'smooth'
                });
            }
        }
    });
});
