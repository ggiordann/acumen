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
    }
    
    $("#login").click(()=>{
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                return auth.signInWithPopup(provider)
                    .then(async (result) => {
                        user = result.user;
                        const idToken = await user.getIdToken();

                        //Save user data to firestore
                        $.ajax({
                            url: "/save-user",
                            type: "POST",
                            headers: { Authorization: `Bearer ${idToken}` },
                            success: () => {
                                console.log("User saved");
                                
                                // Display welcome message
                                $("#email").text(`Welcome ${user.displayName}`);
                                
                                // If there was a redirect parameter, go back to that page
                                if (redirect === 'subscription') {
                                    console.log("Redirecting back to subscription page");
                                    setTimeout(() => {
                                        window.location.href = '../membership_pages/subscription.html';
                                    }, 1000); // Short delay to show welcome message
                                } else {
                                    // Otherwise redirect to app.html
                                    console.log("Redirecting to app page");
                                    setTimeout(() => {
                                        window.location.href = '../app/index.html';
                                    }, 1000);
                                }
                            },
                            error: (xhr) => console.error("Error saving user", xhr)
                        });

                        // schlawg we need to use allat somewhere else $("#email").text(`Welcome ${user.displayName}`);
                    }) 
                    .catch(error =>{
                        console.error("Authentication error:", error);
                        console.error("Error code:", error.code);
                        console.error("Error message:", error.message);
                        console.log("Current domain:", window.location.hostname);
                        console.log("Full URL:", window.location.href);
                    });
            });
    })
})