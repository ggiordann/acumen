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
    if (base64Data) {
      // image data for facebook analysis
      fetch("http://localhost:5500/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64Data })
      })
      .then(res => res.json())
      .then(data => {
        $("#analysisOutput").text("Analysis result: " + data.response);
        try {
          const adData = JSON.parse(data.response);
          // send to Facebook post endpoint
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
          console.error("Error parsing AI output:", e);
          $("#analysisOutput").append("\nError parsing AI output.");
        }
      })
      .catch(err => {
        console.error("Error calling analyze endpoint:", err);
        $("#analysisOutput").text("An error occurred during analysis.");
      });
    } else {
      $("#analysisOutput").text("Please select an image first.");
    }
  });

  $("#analyzeBtnEB").click(function() {
    if (base64Data) {
      // image data for eBay analysis
      fetch("http://localhost:5500/analyze-ebay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64Data })
      })
      .then(res => res.json())
      .then(data => {
        $("#analysisOutput").text("eBay Analysis result: " + data.response);
        try {
          const adData = JSON.parse(data.response);
          // send to eBay post endpoint
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
        $("#analysisOutput").text("An error occurred during eBay analysis.");
      });
    } else {
      $("#analysisOutput").text("Please select an image first.");
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