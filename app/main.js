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
      // image data
      fetch("http://localhost:5500/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64Data })
      })
      .then(res => res.json())
      .then(data => {
        $("#analysisOutput").text("Analysis result: " + data.response);
        try {
          // parse gpt 4o output
          const adData = JSON.parse(data.response);
          // send to post endpoint
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
        } catch (e) { // this is if the AI doesn't do what we expect
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
});