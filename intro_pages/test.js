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
        }, 500);
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
    // Normalize progress to 0-1 range
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
    
    // Hide the info element
    if (infoElement) {
        infoElement.style.opacity = 0;
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
        
        // Initialize content page features
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

// Initialize all content features
function initContentFeatures() {
    // Initialize reveal animations for elements
    initRevealAnimations();
    
    // Initialize statistics counter animations
    initStatCounters();
    
    // Initialize FAQ accordion functionality
    initFaqAccordion();
    
    // Initialize smooth scrolling for navigation
    initSmoothScroll();
    
    // Initialize pricing card interactivity
    initPricingCards();
}

// Initialize reveal animations for elements as they scroll into view
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

// Initialize FAQ accordion functionality
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

// Initialize smooth scrolling for navigation links
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

// Initialize pricing card effects and interactions
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
            
            // Simulate click animation
            setTimeout(() => {
                this.classList.remove('clicked');
                
                // Here you would typically handle the subscription logic
                // For demo purposes, just show an alert
                alert(`Thank you for choosing the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan! This would typically redirect to a checkout page.`);
            }, 300);
        });
    });
}

// Check if we should immediately initialize content features
// (in case someone refreshes the page when already in content mode)
document.addEventListener('DOMContentLoaded', () => {
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
