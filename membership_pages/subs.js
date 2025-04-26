$(document).ready(async function() {
    var auth, provider, firebaseConfig, user;

    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    console.log("Redirect parameter:", redirect);
    
    // Determine if running in local dev
    const isLocal = window.location.hostname.includes('localhost');
    console.log("before fetch");
    try {
        const response = await fetch("/get-api-key");
        const data = await response.json();
        console.log("API Key received:", data.firebaseConfig); // changed to get full config
        firebaseConfig = data.firebaseConfig; // store full config
        await initialiseFirebase();
    } catch (error) {
        console.error("Error fetching API key:", error);
        return;
    }

    // Detect mobile devices for redirect flow
    const isMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);

    async function initialiseFirebase() {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        provider = new firebase.auth.GoogleAuthProvider();
        // Set persistence once on init
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => console.log('Persistence set to LOCAL on init'))
            .catch(err => console.error('Persistence error:', err));
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
                    await $.ajax({ url: "/save-user", type: "POST", headers: { Authorization: `Bearer ${idToken}` } });
                    if (redirect === 'subscription') {
                        window.location.href = '../membership_pages/subscription.html';
                    } else {
                        window.location.href = '../app/index.html';
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
                await $.ajax({ url: "/save-user", type: "POST", headers: { Authorization: `Bearer ${idToken}` } });
                if (redirect === 'subscription') {
                    window.location.href = '../membership_pages/subscription.html';
                } else {
                    window.location.href = '../app/index.html';
                }
            }
        });
    }
    
    // Subscription plan login button: always redirect to Google
    $("#login").off('click').on('click', async () => {
        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            console.log('Using redirect for sign-in');
            auth.signInWithRedirect(provider);
        } catch (error) {
            console.error('Authentication error:', error);
        }
    });
})