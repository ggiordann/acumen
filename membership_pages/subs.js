$(document).ready(async function() {
    var auth, provider, firebaseConfig, user;

    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    console.log("Redirect parameter:", redirect);
    
    // Define API base URL - use useacumen.co for production
    const apiBaseUrl = "https://useacumen.co";
    
    console.log("before fetch");
    try {
        const response = await fetch(`${apiBaseUrl}/get-api-key`);
        const data = await response.json();
        console.log("API Key received:", data.firebaseConfig);
        firebaseConfig = data.firebaseConfig;
        // *** IMPORTANT: Update authDomain to your actual domain for the proxy to work ***
        // firebaseConfig.authDomain = "useacumen.co"; // Reverted: Use default authDomain from backend
        console.log("Using authDomain:", firebaseConfig.authDomain); // Log the domain being used
        await initialiseFirebase();
    } catch (error) {
        console.error("Error fetching API key:", error);
        return;
    }

    // Detect mobile devices for redirect flow
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    async function initialiseFirebase() {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        provider = new firebase.auth.GoogleAuthProvider();
        
        // *** IMPORTANT: Set persistence BEFORE potential redirect and use SESSION ***
        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); // Use SESSION (browserSessionPersistence)
            console.log('Persistence set to SESSION on init');
        } catch (err) {
            console.error('Persistence error:', err);
            // Fallback to inMemory if SESSION fails (less likely but safe)
            try {
                 await auth.setPersistence(firebase.auth.Auth.Persistence.NONE); // Use NONE (inMemoryPersistence)
                 console.log('Persistence fallback to IN_MEMORY');
            } catch (memErr) {
                 console.error('In-memory persistence error:', memErr);
            }
        }

        console.log("Initialised Firebase");
        // Flag to prevent double redirect
        let redirectHandled = false;
        // Handle redirect result (for mobile redirect flow)
        auth.getRedirectResult()
            .then(async (result) => {
                console.log("getRedirectResult returned", result);
                if (result.user) {
                    redirectHandled = true;
                    user = result.user;
                    const idToken = await user.getIdToken();
                    await $.ajax({ url: `${apiBaseUrl}/save-user`, type: "POST", headers: { Authorization: `Bearer ${idToken}` } });
                    if (redirect === 'subscription') {
                        window.location.href = '/membership_pages/subscription.html';
                    } else {
                        window.location.href = '/app/index.html';
                    }
                }
            })
            .catch(error => console.error("Redirect auth error:", error));
        // Fallback: listen for auth state change after redirect
        auth.onAuthStateChanged(async (loggedUser) => {
            console.log("onAuthStateChanged called", loggedUser, "handled?", redirectHandled);
            if (loggedUser && !redirectHandled) {
                redirectHandled = true;
                user = loggedUser;
                const idToken = await user.getIdToken();
                await $.ajax({ url: `${apiBaseUrl}/save-user`, type: "POST", headers: { Authorization: `Bearer ${idToken}` } });
                if (redirect === 'subscription') {
                    window.location.href = '/membership_pages/subscription.html';
                } else {
                    window.location.href = '/app/index.html';
                }
            }
        });
    }
    
    // Google Sign In logic
    $("#login").off('click').on('click', async () => {
        console.log('Login button clicked');
        try {
            // Persistence is now set during initialiseFirebase, no need to set it here again

            if (isMobile) {
                console.log('Mobile device detected, using signInWithRedirect');
                auth.signInWithRedirect(provider);
                // Redirect happens here, no further code in this block will execute on mobile after this line
            } else {
                console.log('Desktop device detected, using signInWithPopup');
                const result = await auth.signInWithPopup(provider);
                console.log("Popup sign-in successful", result);
                user = result.user;
                const idToken = await user.getIdToken();
                // Save user to backend with updated API URL
                await $.ajax({
                    url: `${apiBaseUrl}/save-user`,
                    type: 'POST',
                    headers: { Authorization: `Bearer ${idToken}` }
                });
                console.log("User saved to backend");
                // Redirect after successful save
                if (redirect === 'subscription') {
                    window.location.href = '/membership_pages/subscription.html';
                } else {
                    window.location.href = '/app/index.html';
                }
            }
        } catch (error) {
            console.error('Authentication error:', error);
            // Handle specific errors like popup blocked if needed
            if (error.code === 'auth/popup-blocked') {
                alert('Popup blocked. Please allow popups for this site and try again.');
            } else if (error.code === 'auth/cancelled-popup-request') {
                console.log('Popup closed by user.');
            } else {
                alert(`Login failed: ${error.message}`);
            }
        }
    });
})