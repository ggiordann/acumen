document.addEventListener('DOMContentLoaded', async function() {
    // Show loading overlay until account settings are initialised
    showLoading(); // Remove message argument
    let auth, firebaseConfig, db, storage;
    let currentUser = null;

    // Define API base URL for production
    const apiBaseUrl = "https://useacumen.co";

    // Initialise Firebase
    initFirebase();

    async function initFirebase() {
        try {
            const response = await fetch(`${apiBaseUrl}/get-api-key`);
            const data = await response.json();
            firebaseConfig = data.firebaseConfig;
            
            // Initialise Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            
            auth = firebase.auth();
            db = firebase.firestore();
            
            // Initialise Firebase storage if needed for profile pictures
            if (firebase.storage) {
                storage = firebase.storage();
            }

            // Check if user is already logged in
            auth.onAuthStateChanged(function(user) {
                if (user) {
                    console.log("User is signed in:", user.displayName);
                    currentUser = user;
                    
                    // Update UI with user data
                    updateUIForLoggedInUser(user);
                    
                    // Make sure their token is fresh
                    user.getIdToken(true).then(function(idToken) {
                        console.log("Fresh token obtained");
                        // Load user subscription data
                        loadUserSubscriptionData(user.uid, idToken);
                        // Load user preferences
                        loadUserPreferences(user.uid);
                    });

                    // Once UI update completes, hide loading after a short delay
                    setTimeout(() => hideLoading(), 800);
                } else {
                    console.log("No user is signed in");
                    // Redirect to login page
                    window.location.href = '../membership_pages/subs.html?redirect=account-settings';
                }
            });
        } catch (error) {
            console.error('Error initialising Firebase:', error);
            // Hide loading and show error toast
            hideLoading();
            showToast('Error connecting to services. Please try again later.', 'error');
        }
    }

    // Mobile menu functionality
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

    // Update UI for logged in user
    async function updateUIForLoggedInUser(user) {
        try {
            // Get user's subscription data from session storage or backend
            const subscriptionData = getSubscriptionFromStorage() || { subscriptionLevel: 'free' };
            
            // Update auth container with user info
            const authContainer = document.querySelector('.auth-container');
            if (authContainer) {
                // Clear auth container
                authContainer.innerHTML = '';
                
                // Get user photo URL or use placeholder || 'https://via.placeholder.com/30'
                const photoURL = user.photoURL;
                
                // Add user profile UI with improved error handling
                authContainer.innerHTML = `
                    <div class="user-profile-container">
                        <button class="user-profile-btn">
                            <img src="${photoURL}" alt="${user.displayName}" class="user-avatar">
                            <span class="user-name">${user.displayName}</span>
                            <span class="subscription-badge ${subscriptionData.subscriptionLevel}-badge">${subscriptionData.subscriptionLevel.toUpperCase()}</span>
                        </button>
                        <div class="user-dropdown">
                            <a href="../app/index.html" class="dropdown-item">Dashboard</a>
                            <a href="../membership_pages/account-settings.html" class="dropdown-item">Account Settings</a>
                            <a href="../membership_pages/subscription.html" class="dropdown-item">Subscription</a>
                            <a href="#" class="dropdown-item" id="logout-btn">Sign Out</a>
                        </div>
                    </div>
                `;
                
                // Initialise dropdown toggle
                document.querySelector('.user-profile-btn').addEventListener('click', function(e) {
                    e.stopPropagation();
                    document.querySelector('.user-dropdown').classList.toggle('show');
                });
                
                // Close dropdown when clicking elsewhere
                document.addEventListener('click', function() {
                    document.querySelector('.user-dropdown').classList.remove('show');
                });
                
                // Handle logout
                document.querySelector('#logout-btn').addEventListener('click', function(e) {
                    e.preventDefault();
                    auth.signOut().then(() => {
                        console.log("User signed out");
                        window.location.href = '../app/index.html';
                    }).catch(error => {
                        console.error("Error signing out:", error);
                    });
                });
            }
            
            // Update mobile menu
            updateMobileMenuForLoggedInUser(user, subscriptionData);
            
            // Update account settings form with user data
            populateAccountSettings(user);
        } catch (error) {
            console.error('Error updating UI for logged in user:', error);
        }
    }

    // Get subscription data from session storage
    function getSubscriptionFromStorage() {
        const storedData = sessionStorage.getItem('acumen_user_subscription');
        if (storedData) {
            try {
                return JSON.parse(storedData);
            } catch (e) {
                console.error('Error parsing subscription data from storage:', e);
                return null;
            }
        }
        return null;
    }

    // Update mobile menu UI for logged in user
    // || 'https://via.placeholder.com/30'
    // onerror="this.src='https://via.placeholder.com/30'; this.onerror=null;"
    function updateMobileMenuForLoggedInUser(user, subscription) {
        const mobileAuthSection = document.querySelector('.mobile-menu .mobile-section:last-child');
        if (mobileAuthSection) {
            const photoURL = user.photoURL;
            
            mobileAuthSection.innerHTML = `
                <div class="mobile-section-title">Account</div>
                <div class="mobile-user-info">
                    <img src="${photoURL}" class="mobile-avatar" >
                    <span>${user.displayName}</span>
                </div>
                <a href="../app/index.html" class="mobile-nav-item">
                    <div class="icon"><i class="fas fa-home"></i></div>
                    <span>Dashboard</span>
                </a>
                <a href="../membership_pages/subscription.html" class="mobile-nav-item">
                    <div class="icon"><i class="fas fa-credit-card"></i></div>
                    <span>Subscription</span>
                </a>
                <a href="#" class="mobile-nav-item" id="mobile-logout">
                    <div class="icon"><i class="fas fa-sign-out-alt"></i></div>
                    <span>Sign Out</span>
                </a>
            `;
            
            // Add subscription badge to mobile menu
            if (subscription) {
                const badgeClass = `${subscription.subscriptionLevel}-badge`;
                const mobileBadge = document.createElement('span');
                mobileBadge.className = `subscription-badge ${badgeClass}`;
                mobileBadge.textContent = subscription.subscriptionLevel.toUpperCase();
                
                const userSpan = mobileAuthSection.querySelector('.mobile-user-info span');
                userSpan.appendChild(document.createTextNode(' '));
                userSpan.appendChild(mobileBadge);
            }
            
            // Add logout functionality
            document.getElementById('mobile-logout').addEventListener('click', function(e) {
                e.preventDefault();
                auth.signOut().then(() => {
                    window.location.href = '../app/index.html';
                });
            });
        }
    }

    // Fetch user subscription data from the backend
    async function loadUserSubscriptionData(uid, idToken) {
        try {
            const response = await fetch(`${apiBaseUrl}/get-user-subscription?uid=${uid}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            
            if (response.ok) {
                const userData = await response.json();
                const subscription = userData.subscription;
                
                // Update UI with subscription data
                updateSubscriptionUI(subscription);
                
                // Store subscription info in session storage
                sessionStorage.setItem('acumen_user_subscription', JSON.stringify(subscription));
                
                return subscription;
            } else {
                console.error("Error response from subscription endpoint:", response.status);
                return null;
            }
        } catch (error) {
            console.error("Error fetching subscription data:", error);
            return null;
        }
    }

    // Update subscription UI elements
    function updateSubscriptionUI(subscription) {
        if (!subscription) return;
        
        // Update plan badge in account settings
        const planBadge = document.getElementById('plan-badge');
        const planName = document.getElementById('current-plan-name');
        const renewalDate = document.getElementById('renewal-date');
        const planPeriod = document.getElementById('plan-period');
        const cancelBtn = document.getElementById('cancel-subscription');
        const downgradeBtn = document.getElementById('downgrade-plan');
        const upgradeBtn = document.getElementById('upgrade-plan');
        
        if (planBadge) {
            planBadge.className = `subscription-badge ${subscription.subscriptionLevel}-badge`;
            planBadge.textContent = subscription.subscriptionLevel.toUpperCase();
        }
        
        if (planName) {
            planName.textContent = subscription.subscriptionLevel.charAt(0).toUpperCase() + 
                                  subscription.subscriptionLevel.slice(1);
        }
        
        // Show/hide renewal date
        if (planPeriod && subscription.periodEnd) {
            const renewalDateFormatted = new Date(subscription.periodEnd * 1000).toLocaleDateString();
            renewalDate.textContent = renewalDateFormatted;
            planPeriod.style.display = 'block';
        } else if (planPeriod) {
            planPeriod.style.display = 'none';
        }
        
        // Hide cancel/downgrade buttons for free users
        if (cancelBtn && subscription.subscriptionLevel === 'free') {
            cancelBtn.style.display = 'none';
        } else if (cancelBtn) {
            cancelBtn.style.display = 'block';
        }
        
        if (downgradeBtn && subscription.subscriptionLevel === 'free') {
            downgradeBtn.style.display = 'none';
        } else if (downgradeBtn) {
            downgradeBtn.style.display = 'block';
        }
        
        // Show upgrade button for all users who aren't premium
        if (upgradeBtn && subscription.subscriptionLevel === 'premium') {
            upgradeBtn.style.display = 'none';
        } else if (upgradeBtn) {
            upgradeBtn.style.display = 'block';
        }
        
        // Update downgrade plan options based on current subscription level
        updateDowngradeOptions(subscription.subscriptionLevel);
    }

    // Load user preferences from Firestore
    async function loadUserPreferences(uid) {
        try {
            if (!db) return;
            
            const userPrefsDoc = await db.collection('userPreferences').doc(uid).get();
            
            if (userPrefsDoc.exists) {
                const prefs = userPrefsDoc.data();
                
                // Set email notification preferences
                if (document.getElementById('email-notifications')) {
                    document.getElementById('email-notifications').checked = prefs.emailNotifications !== false;
                }
                
                if (document.getElementById('marketing-emails')) {
                    document.getElementById('marketing-emails').checked = prefs.marketingEmails === true;
                }
                
                // Set theme preference
                if (prefs.theme) {
                    const themeButtons = document.querySelectorAll('.theme-btn');
                    themeButtons.forEach(button => {
                        if (button.getAttribute('data-theme') === prefs.theme) {
                            button.classList.add('active');
                        } else {
                            button.classList.remove('active');
                        }
                    });
                }
                
                // Set two-factor auth preference
                if (document.getElementById('tfa-toggle')) {
                    document.getElementById('tfa-toggle').checked = prefs.twoFactorEnabled === true;
                }
            }
        } catch (error) {
            console.error('Error loading user preferences:', error);
        }
    }

    // Populate account settings form with user data
    function populateAccountSettings(userData) {
        if (!userData) return;

        // Update profile information
        const displayNameInput = document.getElementById('display-name');
        if (displayNameInput) {
            displayNameInput.value = userData.displayName || '';
        }

        // Set profile picture
        const profilePicture = document.getElementById('user-avatar');
        const photoURL = userData.photoURL || 'https://via.placeholder.com/150';
        if (profilePicture) {
            profilePicture.src = photoURL;
            //profilePicture.alt = userData.displayName;
            profilePicture.onerror = function() { this.src = 'https://via.placeholder.com/150'; this.onerror = null; };
        }

        // Update subscription details
        const currentPlanElement = document.getElementById('current-plan');
        if (currentPlanElement) {
            const planDisplayName = getPlanDisplayName(userData.subscriptionLevel || 'free');
            currentPlanElement.textContent = planDisplayName;
        }
        
        // Update account creation date
        const accountCreatedElement = document.getElementById('account-created');
        if (accountCreatedElement && userData.createdAt) {
            const creationDate = new Date(userData.createdAt);
            accountCreatedElement.textContent = creationDate.toLocaleDateString();
        }
        
        // Update preferences if they exist
        if (userData.preferences) {
            document.getElementById('notification-email').checked = userData.preferences.emailNotifications || false;
            document.getElementById('notification-push').checked = userData.preferences.pushNotifications || false;
            document.getElementById('dark-mode').checked = userData.preferences.darkMode || false;
        }
    }

    /**
     * Returns a user-friendly display name for the subscription plan
     * @param {string} planCode - The plan code from the user data
     * @return {string} User-friendly plan name
     */
    function getPlanDisplayName(planCode) {
        const planDisplayNames = {
            'free': 'Free Plan',
            'basic': 'Basic Plan',
            'pro': 'Professional Plan',
            'premium': 'Premium Plan',
            'enterprise': 'Enterprise Plan'
        };
        
        return planDisplayNames[planCode] || 'Free Plan';
    }

    // Save profile information
    const saveProfileBtn = document.getElementById('save-profile');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async function() {
            if (!currentUser) return;
            
            showLoading();
            
            try {
                const newDisplayName = document.getElementById('display-name').value;
                if (newDisplayName && newDisplayName !== currentUser.displayName) {
                    await currentUser.updateProfile({
                        displayName: newDisplayName
                    });
                }
                hideLoading();
                showToast('Profile updated successfully  ', 'success');
                // Refresh page after a short delay to reflect updated display name and photo
                setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
                console.error('Error updating profile:', error);
                hideLoading();
                showToast('Error updating profile. Please try again.', 'error');
            }
        });
    }

    // Change password functionality
    const changePasswordBtn = document.getElementById('change-password');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', async function() {
            if (!currentUser) return;
            
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (!newPassword || newPassword.length < 6) {
                showToast('Password must be at least 6 characters long', 'error');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showToast('Passwords do not match', 'error');
                return;
            }
            
            showLoading();
            
            try {
                await currentUser.updatePassword(newPassword);
                
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-password').value = '';
                
                hideLoading();
                showToast('Password updated successfully', 'success');
            } catch (error) {
                console.error('Error updating password:', error);
                hideLoading();
                
                // Handle specific errors
                if (error.code === 'auth/requires-recent-login') {
                    showToast('Please sign in again before changing your password', 'error');
                    
                    // Re-authenticate user (in production, you would implement a proper re-authentication flow)
                    setTimeout(() => {
                        auth.signOut().then(() => {
                            window.location.href = '../membership_pages/subs.html?redirect=account-settings';
                        });
                    }, 3000);
                } else {
                    showToast('Error updating password. Please try again.', 'error');
                }
            }
        });
    }

    // Toggle password visibility
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', function() {
            const passwordInput = this.previousElementSibling;
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Change the eye icon
            const icon = this.querySelector('i');
            icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
    });

    // Profile picture upload
    const profileImage = document.querySelector('.profile-image');
    const profileUpload = document.getElementById('profile-upload');
    
    if (profileImage && profileUpload) {
        profileImage.addEventListener('click', function() {
            profileUpload.click();
        });
        
        profileUpload.addEventListener('change', async function(event) {
            if (!currentUser || !event.target.files || !event.target.files[0]) return;
            
            const file = event.target.files[0];
            
            if (!file.type.match('image.*')) {
                showToast('Please select an image file', 'error');
                return;
            }
            
            showLoading();
            
            try {
                // If Firebase storage is available, use it to upload the profile picture
                if (storage) {
                    const storageRef = storage.ref();
                    const fileRef = storageRef.child(`profile_pictures/${currentUser.uid}`);
                    
                    await fileRef.put(file);
                    const downloadURL = await fileRef.getDownloadURL();
                    
                    await currentUser.updateProfile({
                        photoURL: downloadURL
                    });
                    
                    // Update the avatar in the UI
                    document.getElementById('user-avatar').src = downloadURL;
                    document.querySelector('.user-avatar').src = downloadURL;
                    if (document.querySelector('.mobile-avatar')) {
                        document.querySelector('.mobile-avatar').src = downloadURL;
                    }
                } else {
                    // Use a simple data URL approach if Firebase storage is not available
                    const reader = new FileReader();
                    reader.onload = async function(e) {
                        const photoURL = e.target.result;
                        
                        await currentUser.updateProfile({
                            photoURL: photoURL
                        });
                        
                        // Update the avatar in the UI
                        document.getElementById('user-avatar').src = photoURL;
                        document.querySelector('.user-avatar').src = photoURL;
                        if (document.querySelector('.mobile-avatar')) {
                            document.querySelector('.mobile-avatar').src = photoURL;
                        }
                    };
                    reader.readAsDataURL(file);
                }
                
                hideLoading();
                showToast('Profile picture updated successfully', 'success');
            } catch (error) {
                console.error('Error uploading profile picture:', error);
                hideLoading();
                showToast('Error uploading profile picture. Please try again.', 'error');
            }
        });
    }

    // Theme selector functionality
    const themeButtons = document.querySelectorAll('.theme-btn');
    themeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all theme buttons
            themeButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Save theme preference to Firestore if user is logged in
            const theme = this.getAttribute('data-theme');
            if (currentUser && db) {
                db.collection('userPreferences').doc(currentUser.uid).set({
                    theme: theme
                }, { merge: true });
            }
        });
    });

    // Notification preferences
    const emailNotifications = document.getElementById('email-notifications');
    const marketingEmails = document.getElementById('marketing-emails');
    
    if (emailNotifications) {
        emailNotifications.addEventListener('change', function() {
            if (currentUser && db) {
                db.collection('userPreferences').doc(currentUser.uid).set({
                    emailNotifications: this.checked
                }, { merge: true });
            }
        });
    }
    
    if (marketingEmails) {
        marketingEmails.addEventListener('change', function() {
            if (currentUser && db) {
                db.collection('userPreferences').doc(currentUser.uid).set({
                    marketingEmails: this.checked
                }, { merge: true });
            }
        });
    }

    // Two-factor authentication toggle
    const tfaToggle = document.getElementById('tfa-toggle');
    if (tfaToggle) {
        tfaToggle.addEventListener('change', function() {
            if (currentUser && db) {
                db.collection('userPreferences').doc(currentUser.uid).set({
                    twoFactorEnabled: this.checked
                }, { merge: true });
                
                // In a real app, you would implement proper 2FA setup here
                if (this.checked) {
                    showToast('Two-factor authentication enabled', 'success');
                } else {
                    showToast('Two-factor authentication disabled', 'success');
                }
            }
        });
    }

    // Delete account functionality
    const deleteAccountBtn = document.getElementById('delete-account');
    const deleteModal = document.getElementById('delete-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const deleteConfirmationInput = document.getElementById('delete-confirmation');
    
    if (deleteAccountBtn && deleteModal) {
        deleteAccountBtn.addEventListener('click', function() {
            deleteModal.classList.add('show');
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            deleteModal.classList.remove('show');
        });
    }
    
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', function() {
            deleteModal.classList.remove('show');
        });
    }
    
    if (deleteConfirmationInput) {
        deleteConfirmationInput.addEventListener('input', function() {
            confirmDeleteBtn.disabled = this.value !== 'DELETE';
        });
    }
    
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async function() {
            if (!currentUser) return;
            
            showLoading();
            
            try {
                // In a real app, you should also delete user data from Firestore
                if (db) {
                    // Delete user preferences
                    await db.collection('userPreferences').doc(currentUser.uid).delete();
                    
                    // Delete other user data as needed
                }
                
                // Delete the user account
                await currentUser.delete();
                
                hideLoading();
                showToast('Account deleted successfully', 'success');
                
                // Redirect to homepage after a short delay
                setTimeout(() => {
                    window.location.href = '../app/index.html';
                }, 2000);
            } catch (error) {
                console.error('Error deleting account:', error);
                hideLoading();
                
                if (error.code === 'auth/requires-recent-login') {
                    showToast('Please sign in again before deleting your account', 'error');
                    
                    // Re-authenticate user (in production, you would implement a proper re-authentication flow)
                    setTimeout(() => {
                        auth.signOut().then(() => {
                            window.location.href = '../membership_pages/subs.html?redirect=account-settings';
                        });
                    }, 3000);
                } else {
                    showToast('Error deleting account. Please try again.', 'error');
                }
            }
        });
    }

    // Toast notification functionality
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.querySelector('.toast-message');
        const toastIcon = document.querySelector('.toast-icon i');
        
        toastMessage.textContent = message;
        
        if (type === 'success') {
            toast.classList.remove('error');
            toastIcon.className = 'fas fa-check-circle';
        } else {
            toast.classList.add('error');
            toastIcon.className = 'fas fa-exclamation-circle';
        }
        
        toast.classList.add('show');
        
        // Hide the toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    // Close toast on click
    const toastClose = document.querySelector('.toast-close');
    if (toastClose) {
        toastClose.addEventListener('click', function() {
            document.getElementById('toast').classList.remove('show');
        });
    }

    // Loading overlay functionality
    function showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('visible');
        }
    }
    
    function hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
        }
    }

    // Add payment method button (stub for demo purposes)
    const addPaymentBtn = document.getElementById('add-payment');
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', function() {
            showToast('Payment method functionality will be implemented in the future', 'success');
        });
    }

    // Subscription management functionality
    const cancelSubscriptionBtn = document.getElementById('cancel-subscription');
    const cancelSubscriptionModal = document.getElementById('cancel-subscription-modal');
    const confirmCancelSubscriptionBtn = document.getElementById('confirm-cancel-subscription');
    const cancelActionBtn = document.getElementById('cancel-action');
    const closeModalButtons = document.querySelectorAll('.close-modal');
    
    // Initialise subscription management UI elements and event listeners
    function initSubscriptionManagement() {
        // Cancel subscription button
        if (cancelSubscriptionBtn) {
            cancelSubscriptionBtn.addEventListener('click', function() {
                cancelSubscriptionModal.classList.add('show');
            });
        }
        
        // Cancel modal action button (Go Back)
        if (cancelActionBtn) {
            cancelActionBtn.addEventListener('click', function() {
                cancelSubscriptionModal.classList.remove('show');
            });
        }
        
        // Confirm cancel subscription button
        if (confirmCancelSubscriptionBtn) {
            confirmCancelSubscriptionBtn.addEventListener('click', async function() {
                if (!currentUser) return;
                
                showLoading();
                
                try {
                    const idToken = await currentUser.getIdToken(true);
                    const response = await fetch(`${apiBaseUrl}/cancel-subscription`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`
                        },
                        body: JSON.stringify({ uid: currentUser.uid })
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok && result.success) {
                        hideLoading();
                        showToast('Your subscription has been canceled successfully', 'success');
                        
                        // Update local subscription data
                        const updatedSubscription = {
                            subscriptionLevel: 'free',
                            status: 'cancelled',
                            updatedAt: new Date().toISOString()
                        };
                        
                        // Store updated subscription in session storage
                        sessionStorage.setItem('acumen_user_subscription', JSON.stringify(updatedSubscription));
                        
                        // Update UI to reflect changes
                        updateSubscriptionUI(updatedSubscription);
                        
                        // Close modal
                        cancelSubscriptionModal.classList.remove('show');
                        
                        // Refresh page after a short delay for a cleaner user experience
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                    } else {
                        throw new Error(result.error || 'Failed to cancel subscription');
                    }
                } catch (error) {
                    console.error('Error canceling subscription:', error);
                    hideLoading();
                    showToast('Error canceling subscription: ' + (error.message || 'Please try again later'), 'error');
                    cancelSubscriptionModal.classList.remove('show');
                }
            });
        }
        
        // Upgrade plan button - redirects to subscription page
        const upgradeBtn = document.getElementById('upgrade-plan');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', function() {
                window.location.href = 'subscription.html';
            });
        }
        
        // Downgrade plan functionality
        const downgradePlanBtn = document.getElementById('downgrade-plan');
        const downgradePlanModal = document.getElementById('downgrade-plan-modal');
        const cancelDowngradeBtn = document.getElementById('cancel-downgrade');
        const confirmDowngradeBtn = document.getElementById('confirm-downgrade');
        const planOptions = document.querySelectorAll('.plan-option');
        
        if (downgradePlanBtn) {
            downgradePlanBtn.addEventListener('click', function() {
                downgradePlanModal.classList.add('show');
            });
        }
        
        if (cancelDowngradeBtn) {
            cancelDowngradeBtn.addEventListener('click', function() {
                downgradePlanModal.classList.remove('show');
            });
        }
        
        // Plan selection in downgrade modal
        if (planOptions.length > 0) {
            planOptions.forEach(option => {
                option.addEventListener('click', function() {
                    // Remove selected class from all options
                    planOptions.forEach(opt => opt.classList.remove('selected'));
                    
                    // Add selected class to clicked option
                    this.classList.add('selected');
                    
                    // Enable confirm button
                    confirmDowngradeBtn.disabled = false;
                    
                    // Store selected plan
                    confirmDowngradeBtn.setAttribute('data-selected-plan', this.getAttribute('data-plan'));
                });
            });
        }
        
        // Confirm downgrade button
        if (confirmDowngradeBtn) {
            confirmDowngradeBtn.addEventListener('click', async function() {
                if (!currentUser) return;
                
                const selectedPlan = this.getAttribute('data-selected-plan');
                if (!selectedPlan) {
                    showToast('Please select a plan to downgrade to', 'error');
                    return;
                }
                
                showLoading();
                
                try {
                    const idToken = await currentUser.getIdToken(true);
                    
                    // For downgrading to free plan, use cancel-subscription endpoint
                    if (selectedPlan === 'free') {
                        const response = await fetch(`${apiBaseUrl}/cancel-subscription`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${idToken}`
                            },
                            body: JSON.stringify({ uid: currentUser.uid })
                        });
                        
                        const result = await response.json();
                        
                        if (response.ok && result.success) {
                            handleSuccessfulDowngrade('free');
                        } else {
                            throw new Error(result.error || 'Failed to downgrade subscription');
                        }
                    } else {
                        // For downgrading to a different paid plan, use force-update-subscription endpoint
                        const response = await fetch(`${apiBaseUrl}/force-update-subscription`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${idToken}`
                            },
                            body: JSON.stringify({
                                uid: currentUser.uid,
                                plan: selectedPlan
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (response.ok && result.success) {
                            handleSuccessfulDowngrade(selectedPlan);
                        } else {
                            throw new Error(result.error || 'Failed to downgrade subscription');
                        }
                    }
                } catch (error) {
                    console.error('Error downgrading subscription:', error);
                    hideLoading();
                    showToast('Error downgrading subscription: ' + (error.message || 'Please try again later'), 'error');
                    downgradePlanModal.classList.remove('show');
                }
            });
        }
        
        // Close all modals with close buttons
        closeModalButtons.forEach(button => {
            button.addEventListener('click', function() {
                const modal = this.closest('.modal');
                if (modal) {
                    modal.classList.remove('show');
                }
            });
        });
    }
    
    // Handle successful downgrade actions
    function handleSuccessfulDowngrade(plan) {
        hideLoading();
        showToast(`Your subscription has been downgraded to ${plan} successfully`, 'success');
        
        // Update local subscription data
        const updatedSubscription = {
            subscriptionLevel: plan,
            status: plan === 'free' ? 'cancelled' : 'active',
            updatedAt: new Date().toISOString()
        };
        
        // Store updated subscription in session storage
        sessionStorage.setItem('acumen_user_subscription', JSON.stringify(updatedSubscription));
        
        // Update UI to reflect changes
        updateSubscriptionUI(updatedSubscription);
        
        // Close modal
        document.getElementById('downgrade-plan-modal').classList.remove('show');
        
        // Refresh page after a short delay for a cleaner user experience
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
    
    // Update downgrade options based on current subscription level
    function updateDowngradeOptions(currentPlan) {
        const planOptions = document.querySelectorAll('.plan-option');
        
        if (!planOptions.length) return;
        
        // Hide options that are higher or equal to current plan level
        planOptions.forEach(option => {
            const planLevel = option.getAttribute('data-plan');
            
            // Plan hierarchy: premium > pro > plus > free
            // Hide options that don't make sense for downgrading
            if (currentPlan === 'premium') {
                // Premium users can downgrade to any plan
                option.style.display = 'block';
            } else if (currentPlan === 'pro') {
                // Pro users can downgrade to plus or free
                option.style.display = planLevel === 'premium' ? 'none' : 'block';
            } else if (currentPlan === 'plus') {
                // Plus users can only downgrade to free
                option.style.display = (planLevel === 'premium' || planLevel === 'pro') ? 'none' : 'block';
            } else {
                // Free users cannot downgrade
                option.style.display = 'none';
            }
        });
    }
    
    // Initialise subscription management after DOM content is loaded
    initSubscriptionManagement();
});