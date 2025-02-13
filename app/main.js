let base64Data = null;

$(document).ready(function() {
  if ($("#google-font").length === 0) {
    $("<link id='google-font' rel='stylesheet' href='https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap'>").appendTo("head");
  }

  // append to css later
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

    const loadingOverlay = $(`
      <div id="loadingOverlay" style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.7);
          z-index: 10000;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          color: white;
          font-size: 32px;
          font-family: 'Roboto', sans-serif;
        ">
          <div style="text-align: center;">
             Analysing Image
             <br><br>
             <div style="margin-left:30%" class="spinner" style="margin-top: 20px;"></div>
          </div>
      </div>
    `);
    $("body").append(loadingOverlay);

    // Determine selected platforms from checkboxes
    const platforms = $("input[name='platform']:checked").map(function() {
      return $(this).val();
    }).get();

    // Set a counter to track pending requests
    let pending = platforms.length;
    function checkOverlay() {
      pending--;
      if (pending <= 0) {
        $("#loadingOverlay").remove();
      }
    }

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
          })
          .finally(() => {
            checkOverlay();
          });
        } catch (e) {
          console.error("Error parsing Facebook AI output:", e);
          $("#analysisOutput").append("\nError parsing Facebook AI output.");
          checkOverlay();
        }
      })
      .catch(err => {
        console.error("Error calling analyze endpoint:", err);
        $("#analysisOutput").text("An error occurred during Facebook analysis.");
        checkOverlay();
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
          })
          .finally(() => {
            checkOverlay();
          });
        } catch (e) {
          console.error("Error parsing eBay AI output:", e);
          $("#analysisOutput").append("\nError parsing eBay AI output.");
          checkOverlay();
        }
      })
      .catch(err => {
        console.error("Error calling analyze-ebay endpoint:", err);
        $("#analysisOutput").append("\nAn error occurred during eBay analysis.");
        checkOverlay();
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
          })
          .finally(() => {
            checkOverlay();
          });
        } catch (e) {
          console.error("Error parsing Depop AI output:", e);
          $("#analysisOutput").append("\nError parsing Depop AI output.");
          checkOverlay();
        }
      })
      .catch(err => {
        console.error("Error calling analyze-depop endpoint:", err);
        $("#analysisOutput").append("\nAn error occurred during Depop analysis.");
        checkOverlay();
      });
    }

  }); // End of analyzeBtn click handler

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