import dotenv from 'dotenv';

dotenv.config();
$(document).ready(function() {
    const firebaseconfig = process.env.FIREBASE_API;
    firebase.initializeApp(firebaseConfig);

    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();

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