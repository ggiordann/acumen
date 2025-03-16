$(document).ready(async function() {
    var auth, provider, firebaseConfig;

    console.log("before fetch");
    await fetch("http://localhost:5000/get-api-key")
        .then(console.log("fetch running"))
        .then(response => response.json())
        .then(data => {
            console.log("In fetch rn");
            console.log("API Key:", data.apiKey);
            apiKey = data.apiKey;
        })
        .catch(error => console.error("Error fetching API key:", error));

    await initialiseFirebase();
    
    console.log("after fetch");


    async function initialiseFirebase() {
        firebaseConfig = apiKey;
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        provider = new firebase.auth.GoogleAuthProvider();
    }

    $("#login").click(()=>{
        auth.signInWithPopup(provider)
            .then(async (result) => {
                const user = result.user;
                const idToken = await user.getIdToken();

                //Save user data to firestore
                $.ajax({
                    url: "http://localhost:3000/save-user",
                    type: "POST",
                    headers: { Authorization: `Bearer ${idToken}` },
                    success: () => console.log("User saved"),
                    error: (xhr) => console.error("Error saving user", xhr)
                });

                $("#email").text("Welcome ${user.displayName}");
            }) 
            .catch(error => console.error(error));
    })
})