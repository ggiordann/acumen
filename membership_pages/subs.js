$(document).ready(async function() {
    var auth, provider, firebaseConfig, apiKey;

    console.log("before fetch");
    try {
        const response = await fetch("http://localhost:1989/get-api-key");
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
    }
    
    $("#login").click(()=>{
        auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
            .then(() => {
                return auth.signInWithPopup(provider)
                    .then(async (result) => {
                    const user = result.user;
                    const idToken = await user.getIdToken();

                    //Save user data to firestore
                    $.ajax({
                        url: "http://localhost:1989/save-user",
                        type: "POST",
                        headers: { Authorization: `Bearer ${idToken}` },
                        success: () => console.log("User saved"),
                        error: (xhr) => console.error("Error saving user", xhr)
                    });

                    $("#email").text(`Welcome ${user.displayName}`);
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