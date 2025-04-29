let base64Data = "";
let previewImages = [];
let currentImageIndex = 0;

$(document).ready(function() {
    // Show loading overlay on auth-buttons immediately
    if ($('.auth-container').length) {
        $('.auth-container').addClass('loading').append('<div class="auth-loading-overlay"></div>');
    }

    // Initialise Firebase
    let auth, firebaseConfig, db;

    // Define API base URL dynamically
    let apiBaseUrl;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use the port your local Node server runs on (ensure it matches server.js)
        apiBaseUrl = "http://localhost:1989"; 
    } else {
        // Use production URL
        apiBaseUrl = "https://useacumen.co";
    }
    console.log("Using API Base URL:", apiBaseUrl); // Add log for debugging

    // tracker to avoid repeating low-credit warnings
    window.lastCredits = Infinity;

    // Get Firebase config
    fetchFirebaseConfig();

    async function fetchFirebaseConfig() {
        try {
            const response = await fetch(`${apiBaseUrl}/get-api-key`);
            const data = await response.json();
            firebaseConfig = data.firebaseConfig;
            initializeFirebase();
        } catch (error) {
            console.error("Error fetching Firebase config:", error);
        }
    }

    function initializeFirebase() {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        // Initialise Firestore
        if (firebase.firestore) {
            db = firebase.firestore();
        }

        // Listen for auth state changes
        auth.onAuthStateChanged(function(user) {
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
                updateUIForSignedInUser(user);
                // If we have cached remaining credits, render immediately without recomputing
                const cached = JSON.parse(sessionStorage.getItem('acumen_user_subscription') || '{}');
                if (typeof cached.remainingCredits === 'number') {
                    updateUIWithSubscriptionData(cached);
                }

                // Check if user has subscription data
                getUserSubscriptionData(user.uid);
            } else {
                console.log("No user is signed in");
                // Redirect to login if not authenticated
                window.location.href = "../membership_pages/subs.html";
                updateUIForSignedOutUser();
            }
        });
    }

    async function getUserSubscriptionData(uid) {
        try {
            console.log("Fetching subscription data for user:", uid);

            // Force token refresh to get latest claims
            const idToken = await auth.currentUser.getIdToken(true);
            console.log("Token refreshed, fetching subscription data");

            const response = await fetch(`${apiBaseUrl}/get-user-subscription?uid=${uid}`, {
                headers: {
                    'Authorization': `Bearer ${idToken}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                console.log("Retrieved subscription data:", userData.subscription);

                // Calculate usage this month and remaining credits
                const usage = await getMonthlyUsage(uid);
                const limits = { free: 5, plus: 100, pro: 500, premium: 1500 };
                const level = userData.subscription.subscriptionLevel.toLowerCase();
                const maxAllowed = limits[level] || 0;
                userData.subscription.usedThisMonth = usage;
                userData.subscription.remainingCredits = Math.max(maxAllowed - usage, 0);

                updateUIWithSubscriptionData(userData.subscription);

                // Store subscription info in session storage (including usage)
                sessionStorage.setItem('acumen_user_subscription', JSON.stringify(userData.subscription));
            } else {
                console.error("Error response from subscription endpoint:", response.status);
            }
        } catch (error) {
            console.error("Error fetching subscription data:", error);
        }
    }

    function updateUIForSignedInUser(user) {
        // Update auth buttons container
        const authContainer = $("#auth-buttons");
        authContainer.empty();

        // Get user photo URL or use placeholder
        const photoURL = user.photoURL; // || 'https://via.placeholder.com/30' fricking packet yo

        console.log("User photo URL:", photoURL);

        // Add user profile button/dropdown with explicit width/height and improved error handling // onerror="this.src='https://via.placeholder.com/30'; console.log('Failed to load profile image, using placeholder'); this.onerror=null;">
        authContainer.append(`
      <div class="user-profile-container">
        <button class="user-profile-btn">
          <img src="${photoURL}" alt="${user.displayName}" class="user-avatar" 
               >
          <span>${user.displayName}</span>
        </button>
        <div class="user-dropdown">
          <a href="../membership_pages/account-settings.html" class="dropdown-item" id="account-settings">Account Settings</a>
          <a href="../membership_pages/subscription.html" class="dropdown-item" id="subscription-settings">Subscription</a>
          <a href="#" class="dropdown-item" id="logout-btn">Sign Out</a>
        </div>
      </div>
    `);

        // Initialise dropdown toggle
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
            auth.signOut().then(() => {
                console.log("User signed out");
                window.location.reload();
            }).catch(error => {
                console.error("Error signing out:", error);
            });
        });

        // Handle account settings click
        $("#account-settings").click(function(e) {
            e.preventDefault();
            window.location.href = "../membership_pages/account-settings.html";
        });

        // Check for subscription data in session storage (from successful checkout)
        const storedSubscription = sessionStorage.getItem('acumen_subscription_updated');
        if (storedSubscription === 'true') {
            console.log("Detected subscription update from session storage");
            // Clear the flag
            sessionStorage.removeItem('acumen_subscription_updated');

            // Force token refresh and fetch updated subscription
            user.getIdToken(true).then(() => {
                console.log("Token refreshed after subscription update");
                getUserSubscriptionData(user.uid);
            });
        }

        // Update mobile menu
        updateMobileMenuForSignedInUser(user);
    }

    function updateUIForSignedOutUser() {
        // Reset auth container to show login/signup buttons
        const authContainer = $("#auth-buttons");
        authContainer.html(`
      <button class="auth-btn login-btn" id="login-button" onclick="window.location.href='../membership_pages/subs.html'">
        Log In
      </button>
      <button class="auth-btn signup-btn" id="signup-button" onclick="window.location.href='../membership_pages/subs.html'">
        Sign Up
      </button>
    `);

        // Update mobile menu
        updateMobileMenuForSignedOutUser();
    }

    function updateUIWithSubscriptionData(subscription) {
        console.log("Updating UI with subscription data:", subscription);

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

        // Add subscription badge to profile
        const badgeClass = `${displayLevel}-badge`;
        const planName = displayLevel.toUpperCase();

        // Remove any existing badge first
        $(".user-profile-btn .subscription-badge").remove();

        // Add the badge to the user profile button
        const planBadge = $(`<span class="subscription-badge ${badgeClass}">${planName}</span>`);
        $(".user-profile-btn span").append(" ").append(planBadge);

        // Update active mode button
        updateActiveMode(subscription.activeMode || "standard");

        // Update remaining credits display
        updateRemainingCredits(subscription.remainingCredits || 0);
        // Also update global listings counter on main page (only if defined)
        if ($('#listings-left').length && typeof subscription.remainingCredits === 'number') {
            $('#listings-left').text(subscription.remainingCredits);
        }
        // Enable or disable analysis based on remaining credits
        if ($('#analyzeBtn').length) {
            $('#analyzeBtn').prop('disabled', !window.remainingCredits || window.remainingCredits <= 0);
        }

        // Update premium features visibility
        updateFeaturesVisibility(displayLevel);

        // Expose remaining credits globally for enforce checks
        window.remainingCredits = subscription.remainingCredits;
    }

    function updateActiveMode(mode) {
        console.log("Updating active mode to:", mode);
        // If there's a mode selector in the UI, update it
        if ($(".mode-selector").length) {
            $(".mode-selector button").removeClass("active");
            $(`.mode-selector button[data-mode="${mode}"]`).addClass("active");
        }
    }

    function updateRemainingCredits(credits) {
        console.log("Updating remaining credits:", credits);
        // show warning toast when credits drop to 3 or fewer for the first time
        if (credits > 0 && credits <= 3 && window.lastCredits > 3) {
            showUploadToast(`Hurry! Only ${credits} listings left this month.`);
        }
        window.lastCredits = credits;

        // Update credits display if it exists
        if ($(".credits-display").length) {
            $(".credits-display .count").text(credits);
        }

        // Update the new listings counter
        if ($("#listings-left").length) {
            const $listingsCount = $("#listings-left");
            const oldValue = parseInt($listingsCount.text()) || 0;

            // Animate count number change
            $({ value: oldValue }).animate({ value: credits }, {
                duration: 800,
                easing: 'swing',
                step: function() {
                    $listingsCount.text(Math.floor(this.value));
                },
                complete: function() {
                    $listingsCount.text(credits);
                }
            });

            // Calculate and update progress bar
            // Get subscription level to determine max credits
            const userData = JSON.parse(sessionStorage.getItem('acumen_user_subscription') || '{}');
            const limits = { free: 5, plus: 100, pro: 500, premium: 1500 };
            const level = userData.subscriptionLevel ? userData.subscriptionLevel.toLowerCase() : 'free';
            const maxAllowed = limits[level] || 5;
            const usedCredits = maxAllowed - credits;
            const percentUsed = Math.min(100, Math.max(0, (usedCredits / maxAllowed) * 100));
            const percentRemaining = 100 - percentUsed;

            // Update progress bar width with animation
            $(".listings-progress-bar").css({
                width: percentRemaining + "%",
                background: getProgressBarColor(percentRemaining)
            });
        }
    }

    // Helper function to get color based on percentage remaining
    function getProgressBarColor(percent) {
        if (percent > 75) {
            return "linear-gradient(90deg, var(--accent-green), #7dffc7)"; // Healthy green
        } else if (percent > 40) {
            return "linear-gradient(90deg, #ffda44, #ffe066)"; // Warning yellow
        } else if (percent > 20) {
            return "linear-gradient(90deg, #ff9800, #ffb74d)"; // Orange
        } else {
            return "linear-gradient(90deg, #f44336, #ef5350)"; // Danger red
        }
    }

    function updateFeaturesVisibility(level) {
        console.log("Updating features visibility for level:", level);
        // Show/hide features based on subscription level
        if (level === 'free') {
            $(".premium-feature, .pro-feature").hide();
            $(".free-feature").show();
        } else if (level === 'pro') {
            $(".premium-feature").hide();
            $(".free-feature, .pro-feature").show();
        } else if (level === 'premium') {
            $(".free-feature, .pro-feature, .premium-feature").show();
        }
    }

    function updateSubscriptionFeatures(subscription) {
        // Implement additional subscription feature updates here
        // For example, show/hide premium features based on the subscription level

        // Determine correct display level (matching the same logic as above)
        let displayLevel = subscription.subscriptionLevel.toLowerCase();
        if (displayLevel === 'pro' && (
                (subscription.features && subscription.features.includes('premium')) ||
                (subscription.price && subscription.price > 15)
            )) {
            displayLevel = 'premium';
        }

        // Example: Toggle visibility of premium features
        if (displayLevel === 'premium' || displayLevel === 'pro') {
            $(".premium-feature").show();
        } else {
            $(".premium-feature").hide();
        }

        // Example: Toggle visibility of advanced features for premium only
        if (displayLevel === 'premium') {
            $(".advanced-feature").show();
        } else {
            $(".advanced-feature").hide();
        }
    }

    function updateMobileMenuBadge(subscription) {
        // Remove any existing badges in mobile menu
        $(".mobile-user-info .subscription-badge, .mobile-user-info .plan-badge").remove();

        // Add subscription badge to mobile menu
        const mobileUserSpan = $(".mobile-user-info span");

        if (mobileUserSpan.length) {
            // Make sure we're not duplicating content - get just the name
            const username = mobileUserSpan.text().split(" ")[0];

            // Create badge with new styling
            const badgeClass = `${subscription.subscriptionLevel}-badge`;
            const mobileBadge = $(`<span class="subscription-badge ${badgeClass}">${subscription.subscriptionLevel.toUpperCase()}</span>`);

            mobileUserSpan.text(username).append(" ").append(mobileBadge);
        }
    }

    // img src = || 'https://via.placeholder.com/30'
    // onerror="this.src='https://via.placeholder.com/30'; console.log('Failed to load mobile profile image, using placeholder'); this.onerror=null;">

    function updateMobileMenuForSignedInUser(user) {
        const mobileAuthSection = $(".mobile-menu .mobile-section:last-child");
        mobileAuthSection.empty();
        mobileAuthSection.append(`
      <div class="mobile-section-title">Account</div>
      <div class="mobile-user-info">
        <img src="${user.photoURL}" class="mobile-avatar"
             >
        <span>${user.displayName}</span>
      </div>
      <a href="../membership_pages/account-settings.html" class="mobile-nav-item" id="mobile-account">
        <div class="icon"><i class="fas fa-user-cog"></i></div>
        <span>Account Settings</span>
      </a>
      <a href="../membership_pages/subscription.html" class="mobile-nav-item">
        <div class="icon"><i class="fas fa-credit-card"></i></div>
        <span>Subscription</span>
      </a>
      <a href="#" class="mobile-nav-item" id="mobile-logout">
        <div class="icon"><i class="fas fa-sign-out-alt"></i></div>
        <span>Sign Out</span>
      </a>
    `);

        // Handle mobile logout
        $("#mobile-logout").click(function(e) {
            e.preventDefault();
            auth.signOut().then(() => {
                console.log("User signed out");
                window.location.reload();
            });
        });
    }

    function updateMobileMenuForSignedOutUser() {
        const mobileAuthSection = $(".mobile-menu .mobile-section:last-child");
        mobileAuthSection.html(`
      <a href="../membership_pages/subs.html" class="auth-btn login-btn" style="display: block; text-align: center; margin-bottom: 1rem;">
        Log In
      </a>
      <a href="../membership_pages/subs.html" class="auth-btn signup-btn" style="display: block; text-align: center;">
        Sign Up
      </a>
    `);
    }

    if ($("#google-font").length === 0) {
        $("<link id='google-font' rel='stylesheet' href='https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap'>").appendTo("head");
    }

    if ($("#spinner-style").length === 0) {
        $("<style id='spinner-style'>")
            .prop("type", "text/css")
            .html(`
        .spinner {
          border: 10px solid #f3f3f3; 
          border-top: 10px solid #00ff9d; 
          border-radius: 50%;
          width: 80px;
          height: 80px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `)
            .appendTo("head");
    }

    // helper to show upload‑limit toast
    function showUploadToast(msg) {
        const t = $('#upload-toast');
        t.find('.toast-message').text(msg);
        t.addClass('show');
        setTimeout(() => t.removeClass('show'), 3000);
    }

    // clear toast on close
    $(document).on('click', '.toast-close', () => {
        $('#upload-toast').removeClass('show');
    });

    // Helper function to resize an image file
    function resizeImage(file, maxWidth = 2048, maxHeight = 2048) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round(height * (maxWidth / width));
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round(width * (maxHeight / height));
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Determine the output format (maintain original if possible, default to JPEG)
                    let outputType = file.type;
                    if (outputType !== 'image/jpeg' && outputType !== 'image/png' && outputType !== 'image/webp') {
                        outputType = 'image/jpeg'; // Default to JPEG for unsupported types
                    }
                    let quality = outputType === 'image/jpeg' ? 0.85 : undefined; // Quality setting for JPEG

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Canvas to Blob conversion failed'));
                            return;
                        }
                        // Create a new File object with a potentially modified name/type
                        const newFileName = file.name.replace(/\.[^.]+$/, outputType === 'image/png' ? '.png' : '.jpg');
                        const resizedFile = new File([blob], newFileName, {
                            type: outputType,
                            lastModified: Date.now()
                        });
                        resolve(resizedFile);
                    }, outputType, quality);
                };
                img.onerror = (err) => {
                    console.error("Error loading image for resizing:", err);
                    reject(new Error('Image loading failed'));
                };
                img.src = event.target.result;
            };
            reader.onerror = (err) => {
                console.error("Error reading file for resizing:", err);
                reject(new Error('File reading failed'));
            };
            reader.readAsDataURL(file);
        });
    }

    // Function to handle file processing (HEIC conversion, resizing, preview, upload)
    async function processFiles(rawFiles) {
        // 1. Convert HEIC to JPEG
        const heicConvertedFiles = await Promise.all(rawFiles.map(async file => {
            const ext = file.name.split('.').pop().toLowerCase();
            // Ensure heic2any is loaded/available
            if ((ext === 'heic' || file.type === 'image/heic') && typeof heic2any === 'function') {
                try {
                    console.log(`Converting HEIC: ${file.name}`);
                    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
                    const newFileName = file.name.replace(/\.[^.]+$/, '.jpg');
                    console.log(`Converted HEIC to ${newFileName}`);
                    return new File([blob], newFileName, { type: 'image/jpeg' });
                } catch (e) {
                    console.error('HEIC conversion failed:', e);
                    showUploadToast(`Failed to convert HEIC file: ${file.name}`);
                    return null; // Indicate failure
                }
            }
            return file;
        }));

        // Filter out failed conversions
        const validFiles = heicConvertedFiles.filter(file => file !== null);

        if (validFiles.length > 10) {
            showUploadToast('Maximum 10 files allowed.');
            $('#fileInput').val(null); // Clear the input
            return;
        }

        // 2. Resize Images
        const resizePromises = validFiles.map(file => {
             // Only resize images
            if (file.type.startsWith('image/')) {
                 console.log(`Resizing image: ${file.name}`);
                 return resizeImage(file).catch(err => {
                     console.error(`Failed to resize ${file.name}:`, err);
                     showUploadToast(`Failed to resize image: ${file.name}`);
                     return null; // Indicate failure but continue
                 });
            }
            return Promise.resolve(file); // Keep non-image files as is
        });

        const resizedFiles = (await Promise.all(resizePromises)).filter(file => file !== null);

        if (resizedFiles.length === 0 && rawFiles.length > 0) {
             showUploadToast('No valid image files could be processed.');
             $('#fileInput').val(null);
             return;
        }

        // 3. Generate Previews and Upload
        base64Data = '';
        previewImages = [];
        $('#preview-container').empty(); // Clear previous previews

        const readFilePromises = resizedFiles.map((file, index) => new Promise((resolve, reject) => {
            // Only generate previews for images
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = e => {
                    $('#preview-container').append(`<img src="${e.target.result}" data-index="${index}" class="preview-image" />`);
                    previewImages.push(e.target.result.split(',')[1]);
                    resolve();
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            } else {
                 resolve(); // Skip preview for non-images
            }
        }));

        try {
            await Promise.all(readFilePromises);

            // Set base64Data for the first image preview for analysis
            base64Data = previewImages[0] || '';

            // 4. Upload processed files
            const formData = new FormData();
            resizedFiles.forEach(f => formData.append('files', f)); // Upload resized files

            const uploadResponse = await fetch(`${apiBaseUrl}/upload`, { method: 'POST', body: formData });
            if (!uploadResponse.ok) {
                 throw new Error(`Upload failed with status ${uploadResponse.status}`);
            }
            const uploadData = await uploadResponse.json();
            console.log('Files uploaded successfully:', uploadData);
            showUploadToast(`${resizedFiles.length} file(s) processed and uploaded.`);

        } catch (err) {
            console.error('Error processing or uploading files:', err);
            showUploadToast('An error occurred during file processing or upload.');
        } finally {
             // Clear the file input regardless of success/failure after processing
             $('#fileInput').val(null);
        }
    }

    // file input handler - uses processFiles
    $('#fileInput').change(function(event) {
        const rawFiles = Array.from(event.target.files || []);
        if (rawFiles.length > 0) {
             processFiles(rawFiles);
        }
    });

    // drag-and-drop support - uses processFiles
    $('#dragDropArea')
        .on('dragover', function(e) {
            e.preventDefault();
            $(this).addClass('dragover');
        })
        .on('dragleave drop', function(e) {
            e.preventDefault();
            $(this).removeClass('dragover');
            if (e.type === 'drop') {
                const rawFiles = Array.from(e.originalEvent.dataTransfer.files);
                 if (rawFiles.length > 0) {
                     processFiles(rawFiles);
                 }
            }
        });

    $("#preview-container").on("click", "img.preview-image", function() {
        currentImageIndex = parseInt($(this).attr("data-index"));
        openLightbox(currentImageIndex);
    });

    $("#lightbox-close").click(function() {
        $("#lightbox").hide();
    });

    $("#lightbox-prev").click(function() {
        currentImageIndex = (currentImageIndex > 0) ? currentImageIndex - 1 : previewImages.length - 1;
        updateLightboxImage(currentImageIndex);
    });

    $("#lightbox-next").click(function() {
        currentImageIndex = (currentImageIndex < previewImages.length - 1) ? currentImageIndex + 1 : 0;
        updateLightboxImage(currentImageIndex);
    });

    function openLightbox(index) {
        updateLightboxImage(index);
        $("#lightbox").css("display", "flex"); // force display as flex to vertically center
    }

    function updateLightboxImage(index) {
        const src = "data:image/jpeg;base64," + previewImages[index];
        $("#lightbox-img").attr("src", src);
    }

    // Initially disable analyse until subscription data arrives
    $("#analyzeBtn").prop('disabled', true);

    $("#analyzeBtn").click(function() {
        const platforms = $("input[name='platform']:checked").map(function() {
            return $(this).val();
        }).get();
        const imageUploaded = !!base64Data; // Check if an image has been processed
        const platformSelected = platforms.length > 0;

        // --- Input Validation ---
        if (!imageUploaded && !platformSelected) {
            showUploadToast("Please upload an image and select a platform first.");
            return;
        }
        if (!imageUploaded) {
            showUploadToast("Please upload an image first.");
            return;
        }
        if (!platformSelected) {
            showUploadToast("Please select a platform first.");
            return;
        }
        // --- End Input Validation ---

        // Prevent analysis if credit info not yet loaded
        if (typeof window.remainingCredits !== 'number') {
            showUploadToast('Loading your monthly quota, please wait...');
            return;
        }
        // Prevent analysis if no listings left
        if (window.remainingCredits <= 0) {
            showUploadToast('You have no listings left this month.');
            return;
        }
        // Redundant check, handled above, but kept for safety
        if (!base64Data) {
            console.error("Analysis attempted without image data."); // Log error instead of using #analysisOutput
            return;
        }

        const loadingOverlay = $(`
      <div id="loadingOverlay" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
        font-size: 36px;
        font-family: 'Roboto', sans-serif;
        font-weight: 700;
        letter-spacing: -0.5px;
      ">
        <div style="text-align: center;">
         <div style="
          background: linear-gradient(120deg, #bfffea, #00ff9d);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: pulse 2s infinite ease-in-out;
         ">Analysing</div>
         <style>
           @keyframes pulse {
           0% { opacity: 0.8; }
           50% { opacity: 1; }
           100% { opacity: 0.8; }
           }
         </style>
         <div class="spinner" style="
          margin: 36px auto 0;
          display: block;
         "></div>
        </div>
      </div>
    `);
        $("body").append(loadingOverlay);

        let pending = platforms.length;
        let analysisSuccessful = true; // Flag to track overall success

        function checkOverlay() {
            pending--;
            if (pending <= 0) {
                $("#loadingOverlay").remove();
                // Deduct one listing use only if at least one analysis was successful
                if (analysisSuccessful && window.remainingCredits > 0) {
                    window.remainingCredits -= 1;
                    // Update UI immediately before potential refresh
                    updateRemainingCredits(window.remainingCredits);
                    // disable if none left
                    if (window.remainingCredits <= 0) {
                        $('#analyzeBtn').prop('disabled', true);
                    }
                    // Record listing usage on server
                    recordListing(auth.currentUser.uid);
                }

                // Show success toast and refresh
                if (analysisSuccessful) {
                    showUploadToast('Analysis complete! Posting listings...');
                    // Wait a moment for the toast to be visible before refreshing
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500); // Adjust delay as needed
                } else {
                    // Optionally show a different toast if there were errors
                    showUploadToast('Analysis finished, but some posts may have failed. Check console for details.');
                    // Don't refresh if there were errors, so user can see console
                }
            }
        }

        if (platforms.includes("facebook")) {
            fetch(`${apiBaseUrl}/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageData: base64Data })
            })
                .then(res => {
                    if (!res.ok) {
                        analysisSuccessful = false; // Mark as failed
                        throw new Error(`Analysis request failed with status ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => {
                    console.log("Facebook Analysis result:", data.response); // Log to console
                    try {
                        const adData = JSON.parse(data.response);
                        fetch(`${apiBaseUrl}/post-facebook`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(adData)
                        })
                            .then(postRes => {
                                if (!postRes.ok) {
                                    analysisSuccessful = false; // Mark as failed
                                    throw new Error(`Facebook post failed with status ${postRes.status}`);
                                }
                                return postRes.json();
                            })
                            .then(postData => {
                                console.log("Facebook Post Success:", postData); // Log success
                            })
                            .catch(err => {
                                analysisSuccessful = false; // Mark as failed
                                console.error("Error posting to Facebook:", err);
                                showUploadToast('Facebook post failed. Check console.');
                            })
                            .finally(() => {
                                checkOverlay();
                            });
                    } catch (e) {
                        analysisSuccessful = false; // Mark as failed
                        console.error("Error parsing Facebook AI output:", e, "Raw response:", data.response);
                        showUploadToast('Error processing Facebook analysis. Check console.');
                        checkOverlay();
                    }
                })
                .catch(err => {
                    analysisSuccessful = false; // Mark as failed
                    console.error("Error calling analyze endpoint for Facebook:", err);
                    showUploadToast('Facebook analysis failed. Check console.'); // Use toast for user feedback
                    checkOverlay();
                });
        }

        if (platforms.includes("ebay")) {
            fetch(`${apiBaseUrl}/analyze-ebay`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageData: base64Data })
            })
                .then(res => {
                    if (!res.ok) {
                        analysisSuccessful = false; // Mark as failed
                        throw new Error(`eBay analysis request failed with status ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => {
                    console.log("eBay Analysis result:", data.response); // Log to console
                    try {
                        const adData = JSON.parse(data.response);
                        fetch(`${apiBaseUrl}/post-ebay`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(adData)
                        })
                            .then(postRes => {
                                if (!postRes.ok) {
                                    analysisSuccessful = false; // Mark as failed
                                    throw new Error(`eBay post failed with status ${postRes.status}`);
                                }
                                return postRes.json();
                            })
                            .then(postData => {
                                console.log("eBay Post Success:", postData); // Log success
                            })
                            .catch(err => {
                                analysisSuccessful = false; // Mark as failed
                                console.error("Error posting to eBay:", err);
                                showUploadToast('eBay post failed. Check console.');
                            })
                            .finally(() => {
                                checkOverlay();
                            });
                    } catch (e) {
                        analysisSuccessful = false; // Mark as failed
                        console.error("Error parsing eBay AI output:", e, "Raw response:", data.response);
                        showUploadToast('Error processing eBay analysis. Check console.');
                        checkOverlay();
                    }
                })
                .catch(err => {
                    analysisSuccessful = false; // Mark as failed
                    console.error("Error calling analyze-ebay endpoint:", err);
                    showUploadToast('eBay analysis failed. Check console.');
                    checkOverlay();
                });
        }

        if (platforms.includes("gumtree")) {
            fetch(`${apiBaseUrl}/analyze-gumtree`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageData: base64Data })
            })
                .then(res => {
                    if (!res.ok) {
                        analysisSuccessful = false; // Mark as failed
                        throw new Error(`Gumtree analysis failed: ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => {
                    console.log("Gumtree Analysis result:", data.response); // Log to console
                    try {
                        const adData = JSON.parse(data.response);
                        fetch(`${apiBaseUrl}/post-gumtree`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(adData)
                        })
                            .then(postRes => {
                                if (!postRes.ok) {
                                    analysisSuccessful = false; // Mark as failed
                                    throw new Error(`Gumtree post failed with status ${postRes.status}`);
                                }
                                return postRes.text(); // Assuming text response for Gumtree post
                            })
                            .then(postData => {
                                console.log("Gumtree Post Success:", postData); // Log success
                            })
                            .catch(err => {
                                analysisSuccessful = false; // Mark as failed
                                console.error("Error posting to Gumtree:", err);
                                showUploadToast('Gumtree post failed. Check console.');
                            })
                            .finally(() => checkOverlay());
                    } catch (e) {
                        analysisSuccessful = false; // Mark as failed
                        console.error("Error parsing Gumtree AI output:", e, "Raw response:", data.response);
                        showUploadToast('Error processing Gumtree analysis. Check console.');
                        checkOverlay();
                    }
                })
                .catch(err => {
                    analysisSuccessful = false; // Mark as failed
                    console.error("Error calling analyze-gumtree endpoint:", err);
                    showUploadToast('Gumtree analysis failed. Check console.');
                    checkOverlay();
                });
        }
    });

    $("#connectFB").click(function() {
        fetch(`${apiBaseUrl}/run-fb-login`)
            .then(response => response.text())
            .then(data => {
                console.log("fb_login.spec.js output:", data);
                alert("Authentication executed successfully.");
            })
            .catch(err => {
                console.error("Error executing fb_login.spec.js:", err);
                alert("Error executing fb_login.spec.js.");
            });
    });

    $("#connectEB").click(function() {
        fetch(`${apiBaseUrl}/run-ebay-login`)
            .then(response => response.text())
            .then(data => {
                console.log("ebay_login.spec.js output:", data);
                alert("Authentication executed successfully.");
            })
            .catch(err => {
                console.error("Error executing ebay_login.spec.js:", err);
                alert("Error executing ebay_login.spec.js.");
            });
    });

    // Connect to Gumtree
    $("#connectGU").click(function() {
        fetch(`${apiBaseUrl}/run-gumtree-login`)
            .then(response => response.text())
            .then(data => {
                console.log("gumtree_login.spec.js output:", data);
                alert("Authentication executed successfully.");
            })
            .catch(err => {
                console.error("Error executing gumtree_login.spec.js:", err);
                alert("Error executing gumtree_login.spec.js.");
            });
    });

    // Fetch count of listings created this month via secure server endpoint
    async function getMonthlyUsage(uid) {
        try {
            const idToken = await auth.currentUser.getIdToken(true);
            const resp = await fetch(`${apiBaseUrl}/get-monthly-usage?uid=${uid}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                return data.usage || 0;
            }
            return 0;
        } catch (e) {
            console.warn('Monthly usage fetch error:', e);
            return 0;
        }
    }

    // Record listing usage on server
    function recordListing(uid) {
        auth.currentUser.getIdToken().then(token => {
            fetch(`${apiBaseUrl}/record-listing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ uid: uid })
            }).catch(err => console.warn('Error recording listing on server:', err));
        });
    }
});