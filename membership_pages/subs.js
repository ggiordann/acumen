$(document).ready(async function() {
    var auth, provider, firebaseConfig, user;

    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    console.log("Redirect parameter:", redirect);
    
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

    async function initialiseFirebase() {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        provider = new firebase.auth.GoogleAuthProvider();
        console.log("Initialised Firebase");

        auth.getRedirectResult()
            .then(async (result) => {
                if (result.user) {
                    user = result.user;
                    const idToken = await user.getIdToken();
                    // Save user data to backend
                    $.ajax({
                        url: "/save-user",
                        type: "POST",
                        headers: { Authorization: `Bearer ${idToken}` },
                        success: () => {
                            console.log("User saved via redirect");
                            $("#email").text(`Welcome ${user.displayName}`);
                            if (redirect === 'subscription') {
                                setTimeout(() => window.location.href = '../membership_pages/subscription.html', 1000);
                            } else {
                                setTimeout(() => window.location.href = '../app/index.html', 1000);
                            }
                        },
                        error: (xhr) => console.error("Error saving user", xhr)
                    });
                }
            })
            .catch(error => {
                console.error("Redirect auth error:", error);
            });
    }
    
    $("#login").off('click').on('click', () => {
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                // Redirect to Google for authentication instead of popup
                return auth.signInWithRedirect(provider);
            });
    });
})