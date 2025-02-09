let base64Data = null;

$(document).ready(function() {
  $("#fileInput").change(function(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        $("#preview").attr("src", e.target.result).show();
        base64Data = e.target.result.split(",")[1];
      };
      reader.readAsDataURL(file);
    }
  });

  $("#analyzeBtn").click(function() {
    if (!base64Data) {
      $("#analysisOutput").text("Please select an image first.");
      return;
    }
    
    // Determine selected platforms from checkboxes
    const platforms = $("input[name='platform']:checked").map(function() {
      return $(this).val();
    }).get();

    // Facebook analysis and posting
    if (platforms.includes("facebook")) {
      fetch("http://localhost:5500/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64Data })
      })
      .then(res => res.json())
      .then(data => {
        $("#analysisOutput").text("Facebook Analysis result: " + data.response);
        try {
          const adData = JSON.parse(data.response);
          fetch("http://localhost:5500/post-facebook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adData)
          })
          .then(postRes => postRes.json())
          .then(postData => {
            $("#analysisOutput").append("\nFacebook Post: " + JSON.stringify(postData));
          })
          .catch(err => {
            console.error("Error posting to Facebook:", err);
            $("#analysisOutput").append("\nError posting to Facebook.");
          });
        } catch (e) {
          console.error("Error parsing Facebook AI output:", e);
          $("#analysisOutput").append("\nError parsing Facebook AI output.");
        }
      })
      .catch(err => {
        console.error("Error calling analyze endpoint:", err);
        $("#analysisOutput").text("An error occurred during Facebook analysis.");
      });
    }

    // eBay analysis and posting
    if (platforms.includes("ebay")) {
      fetch("http://localhost:5500/analyze-ebay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64Data })
      })
      .then(res => res.json())
      .then(data => {
        $("#analysisOutput").append("\neBay Analysis result: " + data.response);
        try {
          const adData = JSON.parse(data.response);
          fetch("http://localhost:5500/post-ebay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adData)
          })
          .then(postRes => postRes.json())
          .then(postData => {
            $("#analysisOutput").append("\neBay Post: " + JSON.stringify(postData));
          })
          .catch(err => {
            console.error("Error posting to eBay:", err);
            $("#analysisOutput").append("\nError posting to eBay.");
          });
        } catch (e) {
          console.error("Error parsing eBay AI output:", e);
          $("#analysisOutput").append("\nError parsing eBay AI output.");
        }
      })
      .catch(err => {
        console.error("Error calling analyze-ebay endpoint:", err);
        $("#analysisOutput").append("\nAn error occurred during eBay analysis.");
      });
    }

    // Depop analysis and posting
    if (platforms.includes("depop")) {
      fetch("http://localhost:5500/analyze-depop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64Data })
      })
      .then(res => res.json())
      .then(data => {
        $("#analysisOutput").append("\nDepop Analysis result: " + data.response);
        try {
          const adData = JSON.parse(data.response);
          fetch("http://localhost:5500/post-depop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adData)
          })
          .then(postRes => postRes.json())
          .then(postData => {
            $("#analysisOutput").append("\nDepop Post: " + JSON.stringify(postData));
          })
          .catch(err => {
            console.error("Error posting to Depop:", err);
            $("#analysisOutput").append("\nError posting to Depop.");
          });
        } catch (e) {
          console.error("Error parsing Depop AI output:", e);
          $("#analysisOutput").append("\nError parsing Depop AI output.");
        }
      })
      .catch(err => {
        console.error("Error calling analyze-depop endpoint:", err);
        $("#analysisOutput").append("\nAn error occurred during Depop analysis.");
      });
    }
  });

  $("#connectFB").click(function() {
    fetch("http://localhost:5500/run-fb-login")
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
    fetch("http://localhost:5500/run-ebay-login")
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

  $("#connectDE").click(function() {
    fetch("http://localhost:5500/run-depop-login")
      .then(response => response.text())
      .then(data => {
        console.log("depop_login.spec.js output:", data);
        alert("Authentication executed successfully.");
      })
      .catch(err => {
        console.error("Error executing depop_login.spec.js:", err);
        alert("Error executing depop_login.spec.js.");
      });
  });
});